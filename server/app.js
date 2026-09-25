const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const config = require('./config');
const { flushPendingSends, hasPendingSends } = require('./services/email');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const superAdminRoutes = require('./routes/superAdmin');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/uploads');
const awarenessRoutes = require('./routes/awareness');
const attachmentRoutes = require('./routes/attachments');
const pdfRoutes = require('./routes/pdf');
const feedbackRoutes = require('./routes/feedback');
const maintenanceRoutes = require('./routes/maintenance');

// ─── Lightweight in-memory rate limiter (no dependency needed) ───────────────
// Sliding-window counter per IP + route key.  Evicts stale entries every 60 s
// so memory stays bounded even under sustained traffic.
const _buckets = new Map();
setInterval(() => { _buckets.clear(); }, 60_000);

function rateLimit({ windowMs = 15 * 60 * 1000, max = 30, keyPrefix = '' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let bucket = _buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      _buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please wait a moment and try again.',
        retryAfter: Math.ceil((bucket.start + windowMs - now) / 1000),
      });
    }
    // Expose rate-limit headers for well-behaved clients.
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    next();
  };
}

function createApp() {
  const app = express();

  // Security HTTP headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content-Security-Policy — restricts which resources the browser may load.
    // 'unsafe-inline' is required because the app uses inline styles and the
    // QR-code SVG component.  'unsafe-eval' is needed for the KratosID SDK
    // if loaded client-side.  Tighten further once inline styles are migrated.
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api-prod.kratosid.com https://api-sandbox.kratosid.com https://oauth2.googleapis.com https://www.googleapis.com",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
    next();
  });
  app.disable('x-powered-by');

  // Behind Vercel's proxy the socket peer is the local edge, so without this
  // req.ip is the same for every visitor and the in-memory rate-limit buckets
  // (login, push/start, push/poll) are shared across ALL users — a handful of
  // sign-ins then 429s the whole deployment. Trusting the proxy makes req.ip
  // reflect the real client via X-Forwarded-For, as it already does for
  // password-reset links.
  app.set('trust proxy', true);

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

  // Serverless hosts freeze the process the moment a response is sent, which
  // would silently truncate notification emails that route handlers dispatch in
  // the background (they are deliberately not awaited, to keep responses fast).
  // Hold the response until the mail queue drains. On a long-running server this
  // middleware is never installed, so background sends stay off the critical
  // path; and when no mail is queued the wrapped send is a plain pass-through.
  if (config.IS_SERVERLESS) {
    app.use((req, res, next) => {
      const originalSend = res.send.bind(res);
      res.send = (body) => {
        if (!hasPendingSends()) return originalSend(body);
        flushPendingSends(15000).finally(() => originalSend(body));
        return res;
      };
      next();
    });
  }

  // API Routes — complaint submission and file uploads are rate-limited.
  const complaintLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'complaint' });
  const uploadLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'upload' });

  app.use('/api/auth', authRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/uploads', uploadLimiter, uploadRoutes);
  app.use('/api/attachments', attachmentRoutes);
  app.use('/api/awareness', awarenessRoutes);
  app.use('/api/pdf', pdfRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/maintenance', maintenanceRoutes);

  // Rate-limit the actual complaint creation endpoint.
  // Student routes handle POST /student/complaints internally, so we apply
  // a global guard on POST to that path here.
  app.use('/api/student/complaints', (req, res, next) => {
    if (req.method === 'POST') return complaintLimiter(req, res, next);
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      system: 'POSH Institutional Grievance Platform',
      storage: db.getEngineName(),
      timestamp: new Date().toISOString()
    });
  });

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
