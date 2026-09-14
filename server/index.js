require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');

const app = createApp();

// Long-running node server (local dev / VPS / Render / Railway).
// Connect to the database BEFORE accepting traffic.
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
    console.log(`Storage: ${db.getEngineName()}`);
    console.log(`=======================================================`);
  });

  // SLA auto-escalation: check every hour for breached SLAs
  const { checkAndEscalate } = require('./services/sla');
  setInterval(() => {
    checkAndEscalate().catch(err => console.error('[SLA] Cron error:', err.message));
  }, 60 * 60 * 1000); // every hour
  console.log('[SLA] Auto-escalation cron started (every 60 minutes)');
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
