// Vercel serverless entry — the Express app as a request handler.
// Database init is memoized on globalThis so warm invocations reuse
// the MongoDB connection pool (see server/db.js initDb()).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createApp } = require('../server/app');
const db = require('../server/db');

const app = createApp();

module.exports = async (req, res) => {
  try {
    await db.initDb();
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    return res.status(503).json({ success: false, message: 'Database unavailable. Please try again shortly.' });
  }
  return app(req, res);
};
