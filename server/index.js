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

  // Statutory escalation ladder: sweep every hour for missed POSH deadlines.
  // On serverless hosts the in-process timer does not run for long — the same
  // sweep is exposed at /api/maintenance/escalate for Vercel Cron.
  const { runEscalationSweep } = require('./services/escalation');
  const { checkAndEscalate } = require('./services/sla');

  // Both sweeps send email, so they run together on the same hourly tick:
  // `checkAndEscalate` warns/notifies before and after SLA deadlines pass, and
  // `runEscalationSweep` walks the statutory L1–L3 ladder.
  const runSweeps = async (label) => {
    try {
      await checkAndEscalate();
    } catch (err) {
      console.error(`[SLA] ${label} error:`, err.message);
    }
    try {
      await runEscalationSweep();
    } catch (err) {
      console.error(`[Escalation] ${label} error:`, err.message);
    }
  };

  setInterval(() => { runSweeps('Cron'); }, 60 * 60 * 1000); // every hour
  runSweeps('Startup sweep');
  console.log('[SLA/Escalation] Hourly deadline sweep started (every 60 minutes)');
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
