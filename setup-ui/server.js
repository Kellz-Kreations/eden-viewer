const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');

// Startup banner
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                    Eden Viewer Setup UI                       ║');
console.log('║                        v1.0.0                                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

console.log('[1/7] 🔧 Loading environment configuration...');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('[2/7] 📦 Initializing Express application...');
const app = express();
const PORT = process.env.SETUP_UI_PORT || 3000;

console.log('[3/7] ⚙️  Configuring middleware...');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

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

  // If Setup UI runs in a Docker container (Docker Desktop), 127.0.0.1 points at the
  // container itself. `host.docker.internal` lets the container reach the host.
  candidates.push({
    label: 'docker-desktop-host',
    identityUrl: `http://host.docker.internal:${plexPort}/identity`,
    // Browser should open the host-published port, not host.docker.internal.
    webUrl: `http://localhost:${plexPort}/web`,
  });

  // Last resort: assume Plex is local to the machine running Setup UI (when running
  // this server directly on the host, not in Docker).
  candidates.push({
    label: 'localhost',
    identityUrl: `http://127.0.0.1:${plexPort}/identity`,
    webUrl: `http://localhost:${plexPort}/web`,
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
      const controller = new AbortController();
      const perAttemptTimeoutMs = Math.max(800, Math.min(1500, remainingMs));
      const timeout = setTimeout(() => controller.abort(), perAttemptTimeoutMs);

      const response = await fetch(candidate.identityUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (response.ok) {
        console.log('  └─ ✅ Plex is running');
        return res.json({
          online: true,
          url: candidate.webUrl,
          identityUrl: candidate.identityUrl,
          tried,
        });
      }

      lastError = {
        message: `HTTP ${response.status}`,
        status: response.status,
        url: candidate.identityUrl,
      };
      console.log(`  └─ ⚠️ Plex responded with status ${response.status}`);
    } catch (error) {
      // Node fetch errors can be opaque; expose cause codes when available.
      const cause = error && error.cause ? error.cause : null;
      const code = cause && cause.code ? cause.code : undefined;
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

// API: Get current configuration status
app.get('/api/status', (req, res) => {
  const envPath = path.join(__dirname, '..', '.env');
  const configExists = fs.existsSync(envPath);
  
  console.log(`  ├─ Config check: ${configExists ? 'Found' : 'Not found'} (${envPath})`);
  
  res.json({
    configured: configExists,
    domain: process.env.PLEX_DOMAIN || null,
    environment: process.env.DEPLOYMENT_TARGET || 'synology'
  });
});

// API: Save configuration
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
    const envPath = path.join(__dirname, '..', '.env');
    fs.writeFileSync(envPath, envContent);
    console.log(`  └─ ✅ Configuration saved to ${envPath}`);
    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    console.error(`  └─ ❌ Failed to save configuration: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve OOBE UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Start server
if (hasCerts) {
  const options = {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile)
  };
  https.createServer(options, app).listen(PORT, () => {
    printStartupComplete('https', PORT, addresses);
  });
} else {
  http.createServer(app).listen(PORT, () => {
    printStartupComplete('http', PORT, addresses);
  });
}

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
