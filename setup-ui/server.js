const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.SETUP_UI_PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get current configuration status
app.get('/api/status', (req, res) => {
  const envPath = path.join(__dirname, '..', '.env');
  const configExists = fs.existsSync(envPath);
  
  res.json({
    configured: configExists,
    domain: process.env.PLEX_DOMAIN || null,
    environment: process.env.DEPLOYMENT_TARGET || 'synology'
  });
});

// API: Save configuration
app.post('/api/configure', (req, res) => {
  const { domain, puid, pgid, timezone, deploymentTarget } = req.body;
  
  const envContent = `# Eden Viewer Configuration
PLEX_DOMAIN=${domain || 'viewer.kellzkreations.com'}
PUID=${puid || '1000'}
PGID=${pgid || '1000'}
TZ=${timezone || 'America/New_York'}
DEPLOYMENT_TARGET=${deploymentTarget || 'synology'}
`;

  try {
    fs.writeFileSync(path.join(__dirname, '..', '.env'), envContent);
    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve OOBE UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// HTTPS or HTTP based on cert availability
const certFile = process.env.SETUP_UI_CERT_FILE;
const keyFile = process.env.SETUP_UI_KEY_FILE;

if (certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  const options = {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile)
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`🔒 Setup UI running at https://localhost:${PORT}`);
  });
} else {
  http.createServer(app).listen(PORT, () => {
    console.log(`⚠️  Setup UI running at http://localhost:${PORT} (no TLS)`);
    console.log(`   Set SETUP_UI_CERT_FILE and SETUP_UI_KEY_FILE for HTTPS`);
  });
}
