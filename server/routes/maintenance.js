const express = require('express');
const router = express.Router();
const config = require('../config');
const { runEscalationSweep } = require('../services/escalation');
const { checkAndEscalate } = require('../services/sla');
const { verifyLedger } = require('../services/ledger');
const { verifyTransport, sendTestEmail, getCatalog, flushPendingSends } = require('../services/email');

// Scheduled jobs cannot carry a user session, so they authenticate with a shared
// secret: `Authorization: Bearer <MAINTENANCE_TOKEN>` (what Vercel Cron sends
// when CRON_SECRET is set) or `x-maintenance-token`. With no token configured
// the endpoints only work outside production.
let _warnedMissingToken = false;

function authorized(req) {
  const token = config.MAINTENANCE_TOKEN;
  const provided = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.headers['x-maintenance-token'];

  if (token) return provided === token;

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  // Without a token every maintenance call is refused in production, which
  // includes the Vercel Cron jobs — they would fail with a silent 401 and the
  // deadline sweeps would simply never run. Say so loudly, once.
  if (isProduction && !_warnedMissingToken) {
    _warnedMissingToken = true;
    console.warn('[Maintenance] ⚠️  Neither MAINTENANCE_TOKEN nor CRON_SECRET is set. Scheduled jobs ' +
      '(deadline sweeps, email diagnostics) will be rejected with 401 in production. ' +
      'Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, so setting CRON_SECRET is enough.');
  }

  return !isProduction;
}

function guard(req, res, next) {
  if (!authorized(req)) {
    return res.status(401).json({ success: false, message: 'Maintenance token required.' });
  }
  next();
}

// Runs the statutory escalation ladder. Vercel Cron issues GET requests,
// so both verbs are accepted.
const escalate = async (req, res) => {
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  try {
    // SLA warnings/breaches first (they email the assigned officer), then the
    // statutory escalation ladder.
    let slaEscalated = null;
    if (!dryRun) {
      slaEscalated = await checkAndEscalate();
    }
    const result = await runEscalationSweep({ dryRun });

    // The SLA sweep fires its mail without awaiting; on serverless this function
    // is frozen the instant it responds, so drain the queue first.
    const emailFlush = await flushPendingSends();

    res.json({ success: true, dryRun, slaEscalated, emailFlush, ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Maintenance] escalation sweep failed:', err);
    res.status(500).json({ success: false, message: 'Escalation sweep failed.' });
  }
};

router.get('/escalate', guard, escalate);
router.post('/escalate', guard, escalate);

// Email transport diagnostics — confirms the sending mailbox and its App
// Password actually authenticate against Gmail, without sending anything.
router.get('/email/verify', guard, async (req, res) => {
  const result = await verifyTransport();
  res.status(result.ok ? 200 : 503).json({ success: result.ok, ...result });
});

// Send a real test message. `?to=` defaults to the configured mailbox so the
// ICC inbox gets the confirmation by default.
router.get('/email/test', guard, async (req, res) => {
  const to = req.query.to || config.SMTP_USER || config.ICC_NOTIFICATION_EMAIL;
  if (!to) {
    return res.status(400).json({ success: false, message: 'No recipient: pass ?to=someone@vitap.ac.in' });
  }
  const result = await sendTestEmail(to, 'maintenance endpoint');
  res.status(result.success ? 200 : 502).json({ success: result.success, to, ...result });
});

// The catalogue of email services and which ones are currently switched on.
router.get('/email/services', guard, (req, res) => {
  const services = getCatalog();
  res.json({
    success: true,
    total: services.length,
    enabled: services.filter(s => s.enabled).length,
    services,
  });
});

// Ledger integrity check without a session (used by uptime/CI checks).
router.get('/ledger/verify', guard, async (req, res) => {
  try {
    res.json({ success: true, ledger: await verifyLedger() });
  } catch (err) {
    console.error('[Maintenance] ledger verify failed:', err);
    res.status(500).json({ success: false, message: 'Ledger verification failed.' });
  }
});

module.exports = router;
