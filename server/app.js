const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const superAdminRoutes = require('./routes/superAdmin');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/uploads');
const awarenessRoutes = require('./routes/awareness');
const attachmentRoutes = require('./routes/attachments');

// ---------------------------------------------------------------------------
// The Express application. Imported by server/index.js (long-running node
// process) and by the Vercel serverless entry (api/index.js).
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();

  // Security HTTP headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.disable('x-powered-by');

  // CORS — explicit allow-list, plus automatic same-origin support so the
  // API works on any deployment domain (e.g. the Vercel URL) with zero config.
  // Set CORS_ORIGINS to additionally allow separate frontend origins.
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5001')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const sameOrigin = origin && req.headers.host && origin.includes(req.headers.host);
    if (origin && (allowedOrigins.includes(origin) || sameOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/attachments', attachmentRoutes);
  app.use('/api/awareness', awarenessRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      system: 'POSH Institutional Grievance Platform',
      storage: db.getEngineName(),
      timestamp: new Date().toISOString()
    });
  });

  // Undefined API routes return JSON, not the SPA shell
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
  });

  // Serve the built SPA when a production bundle exists (long-running deploys).
  // On Vercel the client is served from the CDN and api/index.js never hits this.
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    app.get('*', (req, res) => {
      if (fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      } else {
        res.status(404).json({ success: false, message: 'Not found.' });
      }
    });
  }

  // Malformed JSON and other middleware errors return predictable JSON
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ success: false, message: 'Malformed request body.' });
    }
    console.error('Unhandled server error:', err);
    return res.status(500).json({ success: false, message: 'Unexpected server error. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
