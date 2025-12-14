const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const dns = require('dns').promises;
const net = require('net');
const rateLimit = require('express-rate-limit');

// Startup banner
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                    Eden Viewer Setup UI                       ║');
console.log('║                        v1.0.0                                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

console.log('[1/7] 🔧 Loading environment configuration...');
const repoRoot = (() => {
  const explicit = (process.env.SETUP_UI_REPO_ROOT || '').trim();
  if (explicit) return explicit;
  // When running in Docker via compose.setup.yaml, the repo is mounted at /repo.
  if (fs.existsSync('/repo')) return '/repo';
  // Default local-dev behavior: setup-ui is a subfolder of the repo.
  return path.join(__dirname, '..');
})();

const envPath = path.join(repoRoot, '.env');
require('dotenv').config({ path: envPath });

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config', 'config.json');

console.log('[2/7] 📦 Initializing Express application...');
const app = express();
const PORT = process.env.SETUP_UI_PORT || 8080;

// Rate limiting: max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Apply the rate limiter to all requests
app.use(limiter);

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label || 'operation'} timed out`);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function canResolveHost(urlString, timeoutMs) {
  try {
    const url = new URL(urlString);
    const host = url.hostname;
    if (!host || host === 'localhost' || net.isIP(host)) {
      return true;
    }

    // Keep this very short so we never stall the endpoint.
    const dnsBudgetMs = Math.max(250, Math.min(600, Math.floor(timeoutMs / 2)));
    await withTimeout(dns.lookup(host), dnsBudgetMs, 'dns lookup');
    return true;
  } catch {
    return false;
  }
}

function probeHttpUrl(urlString, timeoutMs) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      reject(e);
      return;
    }

    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      (res) => {
        clearTimeout(hardTimer);
        // Drain data so the socket can close cleanly.
        res.on('data', () => {});
        res.on('end', () => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
        });
      }
    );

    const hardTimer = setTimeout(() => {
      const err = new Error('request timed out');
      err.code = 'ETIMEDOUT';
      req.destroy(err);
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(hardTimer);
      reject(err);
    });

    req.on('close', () => {
      clearTimeout(hardTimer);
    });

    req.end();
  });
}

console.log('[3/7] ⚙️  Configuring middleware...');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Check if first run
function isFirstRun() {
  if (process.env.SETUP_UI_FIRST_RUN === 'true') return true;
  try {
    return !fs.existsSync(CONFIG_PATH);
  } catch (err) {
    console.error('Error checking config:', err.message);
    return true;
  }
}

console.log('[4/7] 🛤️  Registering API routes...');

// API: Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// API: Check if Plex is accessible
app.get('/api/plex-status', async (req, res) => {
  const plexDomain = (process.env.PLEX_DOMAIN || '').trim();
  const plexLanHost = (process.env.PLEX_LAN_HOST || process.env.SYNOLOGY_HOST || '').trim();
  const plexPort = Number(req.query.port || 32400);

  const sanitizeHost = (value) => {
    const host = String(value || '').trim();
    // Allow typical hostnames and IPv4. (Intentionally excludes IPv6 literals for simplicity.)
    if (!host) return '';
    if (!/^[a-z0-9.-]+$/i.test(host)) return '';
    return host;
  };

  // When the Setup UI is opened from another device, returning `localhost` for the Plex URL
  // points at the *client* device, not the server. Prefer the Host header in that case.
  const clientHost = sanitizeHost(req.hostname);
  const clientReachableHost = clientHost && !['localhost', '127.0.0.1'].includes(clientHost) ? clientHost : 'localhost';

  const isRunningInDocker = () => {
    // Heuristic: works for Linux-based containers (Synology, most Docker images).
    // When running on Windows/macOS host, these paths typically do not exist.
    try {
      if (fs.existsSync('/.dockerenv')) return true;
      if (fs.existsSync('/proc/1/cgroup')) {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        return /docker|containerd|kubepods/i.test(cgroup);
      }
    } catch {
      // ignore
    }
    return false;
  };

  // Build candidates in priority order. This allows Setup UI to run from a different machine
  // while still checking Plex on the NAS via domain (Caddy) or LAN host.
  const candidates = [];

  // Explicit host override (mostly for diagnostics): /api/plex-status?host=192.168.1.10&port=32400
  if (req.query.host) {
    const host = String(req.query.host).trim();
    if (host) {
      candidates.push({
        label: 'query-host',
        identityUrl: `http://${host}:${plexPort}/identity`,
        webUrl: `http://${host}:${plexPort}/web`,
      });
    }
  }

  // If a domain is configured, prefer it (works whether the UI runs locally or remotely).
  if (plexDomain) {
    candidates.push(
      {
        label: 'domain-https',
        identityUrl: `https://${plexDomain}/identity`,
        webUrl: `https://${plexDomain}/web`,
      },
      {
        label: 'domain-http',
        identityUrl: `http://${plexDomain}/identity`,
        webUrl: `http://${plexDomain}/web`,
      }
    );
  }

  // Optional LAN host/IP of the NAS (recommended for LAN-only checks).
  if (plexLanHost) {
    candidates.push({
      label: 'lan-host',
      identityUrl: `http://${plexLanHost}:${plexPort}/identity`,
      webUrl: `http://${plexLanHost}:${plexPort}/web`,
    });
  }

  if (isRunningInDocker()) {
    // If Setup UI runs in a Docker container (Docker Desktop), 127.0.0.1 points at the
    // container itself. `host.docker.internal` lets the container reach the host.
    candidates.push({
      label: 'docker-desktop-host',
      identityUrl: `http://host.docker.internal:${plexPort}/identity`,
      // Browser should open the host-published port.
      webUrl: `http://${clientReachableHost}:${plexPort}/web`,
    });
  }

  // Last resort: assume Plex is local to the machine running Setup UI (when running
  // this server directly on the host, not in Docker).
  candidates.push({
    label: 'localhost',
    identityUrl: `http://127.0.0.1:${plexPort}/identity`,
    webUrl: `http://${clientReachableHost}:${plexPort}/web`,
  });

  const tried = [];
  let lastError = null;

  // Keep the endpoint responsive. This is called from the UI on a 10s interval.
  const overallBudgetMs = 4500;
  const startMs = Date.now();

  for (const candidate of candidates) {
    const elapsedMs = Date.now() - startMs;
    const remainingMs = overallBudgetMs - elapsedMs;
    if (remainingMs <= 0) {
      break;
    }

    tried.push(candidate.identityUrl);
    console.log(`  ├─ Checking Plex connectivity (${candidate.label}): ${candidate.identityUrl}`);

    try {
      const perAttemptTimeoutMs = Math.max(800, Math.min(1500, remainingMs));

      // Guard against long DNS stalls that don't reliably respect fetch abort.
      const resolvable = await canResolveHost(candidate.identityUrl, perAttemptTimeoutMs);
      if (!resolvable) {
        lastError = {
          message: 'DNS lookup failed',
          code: 'ENOTFOUND',
          url: candidate.identityUrl,
        };
        console.log('  └─ ❌ Plex not reachable: DNS lookup failed (ENOTFOUND)');
        continue;
      }

      const result = await probeHttpUrl(candidate.identityUrl, perAttemptTimeoutMs);

      if (result.ok) {
        // Parse the claimed status from the XML
        const claimedMatch = body.match(/claimed="(\d+)"/);
        const claimed = claimedMatch ? claimedMatch[1] === '1' : false;
        const machineId = body.match(/machineIdentifier="([^"]+)"/)?.[1] || null;

        console.log('  └─ ✅ Plex is running');
        return res.json({
          online: true,
          claimed: claimed,
          machineIdentifier: machineId,
          url: `https://${process.env.PLEX_DOMAIN || 'localhost:32400'}/web`,
          source: candidate.name
        });
      }

      lastError = {
        message: `HTTP ${result.status}`,
        status: result.status,
        url: candidate.identityUrl,
      };
      console.log(`  └─ ⚠️ Plex responded with status ${result.status}`);
    } catch (error) {
      // Node fetch errors can be opaque; expose cause codes when available.
      const code = error && error.code ? error.code : undefined;
      lastError = {
        message: error?.message || 'fetch failed',
        code,
        url: candidate.identityUrl,
      };
      console.log(`  └─ ❌ Plex not reachable: ${lastError.message}${code ? ` (${code})` : ''}`);
    }
  }

  const suggestedUrl = candidates[0]?.webUrl || (plexDomain ? `https://${plexDomain}/web` : '');
  return res.json({
    online: false,
    url: suggestedUrl || null,
    error: lastError?.message || 'Plex not reachable',
    errorCode: lastError?.code || null,
    tried,
    hint:
      plexLanHost || plexDomain
        ? null
        : 'Set PLEX_LAN_HOST (NAS IP/hostname) in .env to check Plex on your NAS from this machine.',
  });
});

// API: Get current configuration status (merged)
app.get('/api/status', (req, res) => {
  const configExists = fs.existsSync(envPath);
  
  console.log(`  ├─ Config check: ${configExists ? 'Found' : 'Not found'} (${envPath})`);
  
  res.json({
    configured: configExists,
    firstRun: isFirstRun(),
    configExists: fs.existsSync(CONFIG_PATH),
    domain: process.env.PLEX_DOMAIN || null,
    environment: process.env.DEPLOYMENT_TARGET || 'synology'
  });
});

// API: Get current config (OOBE)
app.get('/api/config', (req, res) => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      res.json(config);
    } else {
      res.json({
        puid: process.env.PUID || '1000',
        pgid: process.env.PGID || '1000',
        tz: process.env.TZ || 'America/Los_Angeles',
        dataPath: '/volume1/data',
        appdataPath: '/volume1/docker/appdata',
        plexClaim: '',
        services: { plex: true, sonarr: true, radarr: true }
      });
    }
  } catch (err) {
    console.error('Error reading config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Save config (OOBE)
app.post('/api/config', (req, res) => {
  try {
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    console.log('Config saved:', CONFIG_PATH);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Save .env configuration
app.post('/api/configure', (req, res) => {
  const { domain, puid, pgid, timezone, deploymentTarget } = req.body;
  
  console.log('  ├─ Configuration request received:');
  console.log(`  │  ├─ Domain: ${domain}`);
  console.log(`  │  ├─ PUID: ${puid}`);
  console.log(`  │  ├─ PGID: ${pgid}`);
  console.log(`  │  ├─ Timezone: ${timezone}`);
  console.log(`  │  └─ Target: ${deploymentTarget}`);
  
  const envContent = `# Eden Viewer Configuration
# Generated by Setup UI on ${new Date().toISOString()}

# Custom Domain for HTTPS/TLS
PLEX_DOMAIN=${domain || 'viewer.kellzkreations.com'}

# Container User/Group IDs
PUID=${puid || '1000'}
PGID=${pgid || '1000'}

# Timezone
TZ=${timezone || 'America/New_York'}

# Deployment Target (synology or azure)
DEPLOYMENT_TARGET=${deploymentTarget || 'synology'}
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`  └─ ✅ Configuration saved to ${envPath}`);
    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    console.error(`  └─ ❌ Failed to save configuration: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve OOBE UI (must be last)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Setup UI not found. Ensure public/index.html exists.');
  }
});

console.log('[5/7] 🔐 Checking TLS certificate configuration...');

const certFile = process.env.SETUP_UI_CERT_FILE;
const keyFile = process.env.SETUP_UI_KEY_FILE;
const hasCerts = certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile);

if (hasCerts) {
  console.log(`  ├─ Certificate: ${certFile}`);
  console.log(`  └─ Private Key: ${keyFile}`);
} else {
  console.log('  └─ No TLS certificates configured (using HTTP)');
}

console.log('[6/7] 🌐 Detecting network interfaces...');

const networkInterfaces = os.networkInterfaces();
const addresses = [];
Object.keys(networkInterfaces).forEach((ifname) => {
  networkInterfaces[ifname].forEach((iface) => {
    if (iface.family === 'IPv4' && !iface.internal) {
      addresses.push({ name: ifname, address: iface.address });
    }
  });
});

if (addresses.length > 0) {
  addresses.forEach((addr, idx) => {
    const prefix = idx === addresses.length - 1 ? '└─' : '├─';
    console.log(`  ${prefix} ${addr.name}: ${addr.address}`);
  });
} else {
  console.log('  └─ No external network interfaces found');
}

console.log('[7/7] 🚀 Starting HTTP server...');
console.log('');

// Start server with fallback to random port if default is in use
function startServer(port, retryWithRandom = true) {
  const server = hasCerts
    ? https.createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app)
    : http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retryWithRandom) {
      console.log(`⚠️  Port ${port} is in use, trying random port...`);
      startServer(0, false); // 0 = let OS assign random available port
    } else {
      console.error(`❌ Failed to start server: ${err.message}`);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const actualPort = server.address().port;
    printStartupComplete(hasCerts ? 'https' : 'http', actualPort, addresses);
  });
}

startServer(PORT);

function printStartupComplete(protocol, port, addresses) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    ✅ Server Ready                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Protocol:  ${protocol.toUpperCase().padEnd(48)}║`);
  console.log(`║  Port:      ${port.toString().padEnd(48)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Access URLs:                                                ║');
  console.log(`║    Local:   ${protocol}://localhost:${port}/`.padEnd(63) + '║');
  
  addresses.forEach((addr) => {
    const url = `${protocol}://${addr.address}:${port}/`;
    console.log(`║    ${addr.name}:`.padEnd(12) + url.padEnd(51) + '║');
  });
  
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  API Endpoints:                                              ║');
  console.log('║    GET  /api/health    - Health check                        ║');
  console.log('║    GET  /api/status    - Configuration status                ║');
  console.log('║    POST /api/configure - Save configuration                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  if (protocol === 'http') {
    console.log('║  ⚠️  Running without TLS - Set SETUP_UI_CERT_FILE and        ║');
    console.log('║     SETUP_UI_KEY_FILE environment variables for HTTPS       ║');
  } else {
    console.log('║  🔒 TLS enabled - Connection is secure                       ║');
  }
  
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Received SIGINT signal');
  console.log('👋 Shutting down Eden Viewer Setup UI...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('🛑 Received SIGTERM signal');
  console.log('👋 Shutting down Eden Viewer Setup UI...');
  process.exit(0);
});
