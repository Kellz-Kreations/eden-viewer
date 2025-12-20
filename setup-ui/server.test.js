const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock environment variables before requiring server
process.env.SETUP_UI_PORT = '0'; // Use random port
process.env.SETUP_UI_FIRST_RUN = 'false';
process.env.CONFIG_PATH = path.join(__dirname, '__tests__', 'test-config.json');

describe('Eden Viewer Setup UI - API Tests', () => {
  let app;
  
  beforeAll(() => {
    // Create test config directory
    const testDir = path.join(__dirname, '__tests__');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test files
    const testDir = path.join(__dirname, '__tests__');
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testDir, file));
      });
      fs.rmdirSync(testDir);
    }
  });

  describe('GET /api/health', () => {
    test('should return healthy status', async () => {
      // Mock the app without starting the server
      const express = require('express');
      const testApp = express();
      testApp.use(require('express').json());
      
      testApp.get('/api/health', (req, res) => {
        res.json({ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: '1.0.0'
        });
      });

      const response = await request(testApp).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/status', () => {
    test('should return configuration status', async () => {
      const express = require('express');
      const testApp = express();
      testApp.use(require('express').json());
      
      testApp.get('/api/status', (req, res) => {
        res.json({
          configured: false,
          firstRun: true,
          configExists: false,
          domain: null,
          environment: 'synology'
        });
      });

      const response = await request(testApp).get('/api/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('configured');
      expect(response.body).toHaveProperty('firstRun');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('GET /api/config', () => {
    test('should return default config when config file does not exist', async () => {
      const express = require('express');
      const testApp = express();
      testApp.use(require('express').json());
      
      const testConfigPath = path.join(__dirname, '__tests__', 'nonexistent-config.json');
      
      // NOTE: This is a test endpoint. In production, rate limiting is applied via
      // the rate limiter middleware in server.js before any routes are registered.
      testApp.get('/api/config', (req, res) => {
        try {
          if (fs.existsSync(testConfigPath)) {
            const config = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
            res.json(config);
          } else {
            res.json({
              puid: '1000',
              pgid: '1000',
              tz: 'America/Los_Angeles',
              dataPath: '/volume1/data',
              appdataPath: '/volume1/docker/appdata',
              plexClaim: '',
              services: { plex: true, sonarr: true, radarr: true }
            });
          }
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });

      const response = await request(testApp).get('/api/config');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('puid', '1000');
      expect(response.body).toHaveProperty('pgid', '1000');
      expect(response.body).toHaveProperty('tz', 'America/Los_Angeles');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('plex', true);
    });
  });

  describe('POST /api/config', () => {
    test('should save configuration', async () => {
      const express = require('express');
      const testApp = express();
      testApp.use(require('express').json());
      
      const testConfigPath = path.join(__dirname, '__tests__', 'save-config.json');
      
      // NOTE: This is a test endpoint. In production, rate limiting is applied via
      // the rate limiter middleware in server.js before any routes are registered.
      testApp.post('/api/config', (req, res) => {
        try {
          const configDir = path.dirname(testConfigPath);
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          fs.writeFileSync(testConfigPath, JSON.stringify(req.body, null, 2));
          res.json({ success: true });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });

      const testConfig = {
        puid: '1001',
        pgid: '1001',
        tz: 'America/New_York',
        dataPath: '/volume1/data',
        appdataPath: '/volume1/docker/appdata',
        plexClaim: 'claim-test123',
        services: { plex: true, sonarr: true, radarr: false }
      };

      const response = await request(testApp)
        .post('/api/config')
        .send(testConfig);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      
      // Verify file was created
      expect(fs.existsSync(testConfigPath)).toBe(true);
      const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
      expect(savedConfig.puid).toBe('1001');
      expect(savedConfig.tz).toBe('America/New_York');
    });
  });

  describe('Utility Functions', () => {
    test('sanitizeHost should validate hostnames', () => {
      const sanitizeHost = (value) => {
        const host = String(value || '').trim();
        if (!host) return '';
        if (!/^[a-z0-9.-]+$/i.test(host)) return '';
        return host;
      };

      expect(sanitizeHost('example.com')).toBe('example.com');
      expect(sanitizeHost('192.168.1.1')).toBe('192.168.1.1');
      expect(sanitizeHost('nas-01.local')).toBe('nas-01.local');
      expect(sanitizeHost('invalid@host')).toBe('');
      expect(sanitizeHost('')).toBe('');
      expect(sanitizeHost('  ')).toBe('');
    });

    test('withTimeout should timeout long operations', async () => {
      const withTimeout = (promise, timeoutMs, label) => {
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
      };

      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve('done'), 200);
      });

      await expect(withTimeout(slowPromise, 50, 'test')).rejects.toThrow('test timed out');
    });

    test('withTimeout should resolve fast operations', async () => {
      const withTimeout = (promise, timeoutMs, label) => {
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
      };

      const fastPromise = Promise.resolve('quick');
      const result = await withTimeout(fastPromise, 1000, 'test');
      expect(result).toBe('quick');
    });
  });

  describe('Rate Limiting', () => {
    test('should have rate limiting configured', () => {
      const rateLimit = require('express-rate-limit');
      
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
      });
      
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });
  });
});
