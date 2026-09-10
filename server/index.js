require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const superAdminRoutes = require('./routes/superAdmin');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/uploads');
const awarenessRoutes = require('./routes/awareness');
const attachmentRoutes = require('./routes/attachments');

const app = express();
const db = require('./db');

// Security HTTP headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.disable('x-powered-by');

// Middleware — explicit CORS allow-list instead of reflecting any origin
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5001')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// NOTE: uploaded evidence files are NOT served statically.
// They are delivered exclusively through the authenticated,
// ownership-checked route in routes/attachments.js.

// Serve client production build if built
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
if (require('fs').existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}

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

// Malformed JSON and other middleware errors return predictable JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Malformed request body.' });
  }
  console.error('Unhandled server error:', err);
  return res.status(500).json({ success: false, message: 'Unexpected server error. Please try again.' });
});

// Catch-all SPA route for frontend routing (if static build exists)
app.get('*', (req, res) => {
  if (require('fs').existsSync(path.join(clientBuildPath, 'index.html'))) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API route not found. Frontend dev server runs on http://localhost:5173' });
  }
});

// Connect to the database BEFORE accepting traffic
(async () => {
  try {
    await db.initDb();
  } catch (err) {
    console.error('Fatal: database initialization failed:', err.message);
    process.exit(1);
  }

  app.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(`POSH Institutional Grievance Platform Server Running`);
    console.log(`Port: ${config.PORT}`);
    console.log(`=======================================================`);
  });
})();

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n${signal} received — closing database connection...`);
  try {
    await db.closeDb();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
