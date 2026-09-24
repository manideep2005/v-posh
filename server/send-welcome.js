require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * One-off welcome-mail backfill for accounts that predate the welcome email.
 *
 * Safe by construction:
 *   - dry run by default — nothing is sent unless you pass --send
 *   - idempotent: anyone already recorded as welcomed in `email_log` is skipped,
 *     so re-running after a partial batch only contacts the people who missed out
 *   - refuses to run when SMTP is not configured (otherwise it would silently
 *     "log" mail instead of sending it)
 *   - stops early after several consecutive failures, so a bad credential or a
 *     Gmail throttle cannot burn the daily quota
 *
 * Usage:
 *   node server/send-welcome.js                          # dry run: who would get it
 *   node server/send-welcome.js --send                   # send (up to --limit)
 *   node server/send-welcome.js --send --limit=500       # first 500 of the backlog
 *   node server/send-welcome.js --send --roles=student   # students only
 *   node server/send-welcome.js --send --all             # re-send even to welcomed users
 *   node server/send-welcome.js --send --only=a@x.in     # single recipient test
 *   node server/send-welcome.js --send --include-disabled
 *
 * Gmail allows ~2,000 messages per mailbox per day and suspends sending for up to
 * 24 h if it is exceeded, so --limit defaults to 1800. Split a bigger backlog
 * across days; the script tells you exactly how many remain.
 */

const db = require('./db');
const email = require('./services/email');

// ─── Flags ──────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const value = (name, fallback) => {
  const match = argv.find(a => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const SEND = has('--send');
const SEND_ALL = has('--all');
const INCLUDE_DISABLED = has('--include-disabled');
const LIMIT = Math.max(1, parseInt(value('limit', '1800'), 10));
const ONLY = value('only', '');
const ROLES = value('roles', 'student,faculty')
  .split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
const WELCOME_ROLES = new Set(['student', 'faculty', 'admin', 'super_admin']);
const MAX_CONSECUTIVE_FAILURES = 3;

const ROLE_LABELS = { student: 'Student', faculty: 'Faculty', admin: 'Admin', super_admin: 'Super Admin' };

// ─── Helpers ────────────────────────────────────────────────────────────────

function msToClock(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Anyone we have already recorded as welcomed, matched on id or address. */
function welcomedSet(emailLogRows) {
  const welcomed = new Set();
  for (const row of emailLogRows) {
    if (row.service !== 'account_provisioned') continue;
    if (row.status !== 'sent' && row.status !== 'dry_run') continue;
    if (row.meta && row.meta.welcome) {
      if (row.meta.userId) welcomed.add(`id:${row.meta.userId}`);
      if (row.to) welcomed.add(`email:${String(row.to).toLowerCase()}`);
    }
  }
  return welcomed;
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  await db.initDb();

  const [allUsers, emailLogRows] = await Promise.all([
    db.users.find(),
    db.emailLog.find(),
  ]);

  console.log('─'.repeat(72));
  console.log('V-POSH welcome-mail backfill');
  console.log('─'.repeat(72));
  console.log(`Engine            : ${db.getEngineName()}`);
  console.log(`SMTP configured   : ${email.isConfigured() ? 'yes' : 'NO'}`);
  console.log(`Mode              : ${SEND ? 'SEND (live email)' : 'DRY RUN (nothing sent)'}`);
  console.log(`Roles             : ${ROLES.join(', ')}`);
  console.log(`Daily cap (--limit): ${LIMIT}`);
  console.log(`Total users in DB : ${allUsers.length}`);

  if (SEND && !email.isConfigured()) {
    console.error('\nREFUSING TO SEND: SMTP_PASS is not configured, so messages would be');
    console.error('console-logged instead of delivered. Add SMTP_PASS to .env and retry.');
    process.exit(1);
  }

  // Filter in JS rather than with Mongo-only operators, so the script behaves
  // identically on the JSON fallback engine.
  const welcomed = welcomedSet(emailLogRows);
  const skipped = { welcomed: 0, disabled: 0, noEmail: 0, role: 0, invalidEmail: 0, inactive: 0 };

  const candidates = allUsers.filter((user) => {
    if (ONLY) return String(user.email || '').toLowerCase() === ONLY.toLowerCase();

    const role = String(user.role || '').toLowerCase();
    if (!ROLES.includes(role)) { skipped.role++; return false; }
    if (!WELCOME_ROLES.has(role)) { skipped.role++; return false; }

    if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) { skipped.noEmail++; return false; }

    if (user.status === 'disabled' && !INCLUDE_DISABLED) { skipped.disabled++; return false; }
    if (user.status && user.status !== 'active' && !INCLUDE_DISABLED) { skipped.inactive++; return false; }

    if (!SEND_ALL && (welcomed.has(`id:${user.id}`) || welcomed.has(`email:${String(user.email).toLowerCase()}`))) {
      skipped.welcomed++;
      return false;
    }
    return true;
  });

  const alreadyWelcomed = skipped.welcomed;
  const batch = candidates.slice(0, LIMIT);
  const remainingAfter = Math.max(0, candidates.length - batch.length);

  console.log(`Already welcomed  : ${alreadyWelcomed} (skipped)`);
  console.log(`Skipped otherwise : ${skipped.disabled} disabled, ${skipped.inactive} inactive, ${skipped.role} other roles, ${skipped.noEmail} no/invalid email`);
  console.log(`Backlog to send   : ${candidates.length}`);
  console.log(`This run          : ${batch.length}${remainingAfter ? ` (leaving ${remainingAfter} for a later run)` : ''}`);
  console.log('─'.repeat(72));

  if (!batch.length) {
    console.log('Nothing to do — every eligible account has already received the welcome mail.');
    await db.closeDb();
    process.exit(0);
  }

  batch.forEach((u, i) => {
    console.log(`${String(i + 1).padStart(4)}. ${String(u.email).padEnd(42)} ${ROLE_LABELS[u.role] || u.role}${u.status !== 'active' ? ` [${u.status}]` : ''}`);
  });

  const gap = parseInt(process.env.EMAIL_MIN_SEND_GAP_MS || '300', 10);
  console.log('─'.repeat(72));
  console.log(`Estimated send time: ~${msToClock(batch.length * (gap + 400))} (paced at ${gap}ms between sends)`);

  if (!SEND) {
    console.log('\nDRY RUN — no email sent. Re-run with --send to deliver this batch.');
    await db.closeDb();
    process.exit(0);
  }

  console.log('\nSending...\n');
  let sent = 0, failed = 0, consecutiveFailures = 0;
  const failures = [];

  for (const [index, user] of batch.entries()) {
    const result = await email.sendService('account_provisioned', {
      to: user.email,
      data: {
        welcome: true,
        userName: user.name,
        email: user.email,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role] || user.role,
        employeeId: user.studentId || user.employeeId || '—',
        department: user.department || 'Not set yet — add it from your profile',
        designation: user.year || '—',
        createdBy: 'VIT-AP ICC (existing account)',
      },
      meta: { userId: user.id, welcome: true, backfill: true },
    });

    const position = `[${index + 1}/${batch.length}]`;

    if (result.success) {
      sent++;
      consecutiveFailures = 0;
      console.log(`${position} ✅ ${user.email}`);
    } else {
      failed++;
      consecutiveFailures++;
      failures.push({ email: user.email, error: result.error || 'unknown' });
      console.log(`${position} ❌ ${user.email} — ${result.error || 'unknown error'}`);

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`\nAborting: ${MAX_CONSECUTIVE_FAILURES} consecutive failures. This is usually a bad`);
        console.error('credential or a Gmail throttle. Nothing further was sent. Fix the cause and');
        console.error('re-run the same command — already-delivered recipients are skipped automatically.');
        break;
      }
    }
  }

  console.log('\n' + '─'.repeat(72));
  console.log(`Delivered : ${sent}`);
  console.log(`Failed    : ${failed}`);
  const left = Math.max(0, candidates.length - sent);
  console.log(`Still owed: ${left}${left > 0 ? '  → re-run this command to continue (welcomed users are skipped)' : ''}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ${f.email}: ${f.error}`);
  }
  console.log('Every attempt is recorded in the `email_log` collection.');
  console.log('─'.repeat(72));

  await db.closeDb();
  process.exit(failed && !sent ? 1 : 0);
})().catch(async (err) => {
  console.error('\nFAILED:', err.message);
  try { await db.closeDb(); } catch { /* ignore */ }
  process.exit(1);
});
