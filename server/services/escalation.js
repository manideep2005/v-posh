// Statutory escalation ladder.
//
// Escalation is driven by the POSH statutory milestones (services/statutory.js)
// rather than by raw hours, so the reason recorded on the case always names the
// obligation that was missed.
//
//   L1 — 1 day past a statutory deadline  → assigned officer
//   L2 — 3 days past                     → assigned officer + all ICC admins
//   L3 — 7 days past                     → + all super admins, by email
//
// Each level is recorded once per case per 24h (marker in the case timeline),
// so running the sweep hourly cannot spam anyone.

const db = require('../db');
const { statutoryMilestones } = require('./statutory');
const { sendService } = require('./email');
const { logSystemAudit } = require('../middleware/audit');

const LEVELS = [
  { level: 1, minDaysOverdue: 1, audience: 'officer' },
  { level: 2, minDaysOverdue: 3, audience: 'admins' },
  { level: 3, minDaysOverdue: 7, audience: 'super-admins' },
];

const MARKER = (level) => `[ESCALATION:L${level}]`;

function levelFor(daysOverdue) {
  let match = null;
  for (const l of LEVELS) {
    if (daysOverdue >= l.minDaysOverdue) match = l;
  }
  return match;
}

async function alreadyEscalated(complaintId, level, history) {
  const marker = MARKER(level);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history.some(h =>
    h.complaintId === complaintId &&
    typeof h.comment === 'string' &&
    h.comment.includes(marker) &&
    new Date(h.createdAt).getTime() > cutoff
  );
}

/**
 * Run the sweep. Safe to call from a cron, a maintenance endpoint, or on boot.
 */
async function runEscalationSweep({ dryRun = false } = {}) {
  const complaints = await db.complaints.find();
  const open = complaints.filter(c => c.status !== 'Resolved');
  if (!open.length) return { scanned: 0, escalated: [], emailsSent: 0 };

  const users = await db.users.find();
  const allHistory = await db.statusHistory.find();
  const admins = users.filter(u => u.role === 'admin' && u.status === 'active');
  const superAdmins = users.filter(u => u.role === 'super_admin' && u.status === 'active');

  const escalated = [];
  let emailsSent = 0;

  for (const complaint of open) {
    const history = allHistory.filter(h => h.complaintId === complaint.id);
    const { milestones } = statutoryMilestones(complaint, history);
    const overdue = milestones
      .filter(m => m.status === 'overdue' && m.key !== 'filingWindow')
      .sort((a, b) => a.daysRemaining - b.daysRemaining); // most negative first

    if (!overdue.length) continue;

    const worst = overdue[0];
    const daysOverdue = Math.abs(worst.daysRemaining);
    const levelDef = levelFor(daysOverdue);
    if (!levelDef) continue;

    if (await alreadyEscalated(complaint.id, levelDef.level, history)) continue;

    const reason = `${worst.label} overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} (${worst.legalRef})`;
    if (dryRun) {
      escalated.push({ referenceId: complaint.referenceId, level: levelDef.level, reason, dryRun: true });
      continue;
    }

    // 1. Record on the case timeline so it is visible in the audit view of the case.
    await db.statusHistory.insertOne({
      complaintId: complaint.id,
      previousStatus: complaint.status,
      newStatus: complaint.status,
      changedById: 'SYSTEM',
      changedByName: `Escalation L${levelDef.level}`,
      changedByRole: 'system',
      comment: `${MARKER(levelDef.level)} ⚠️ ${reason}. Escalated to ${levelDef.audience === 'officer' ? 'the assigned officer' : levelDef.audience === 'admins' ? 'the ICC committee' : 'the system administrators'}.`,
    });

    // 2. Notify the right people in-app.
    const recipients = [];
    if (levelDef.audience === 'officer') {
      if (complaint.assignedAdminId) recipients.push(users.find(u => u.id === complaint.assignedAdminId));
    } else if (levelDef.audience === 'admins') {
      if (complaint.assignedAdminId) recipients.push(users.find(u => u.id === complaint.assignedAdminId));
      recipients.push(...admins);
    } else {
      if (complaint.assignedAdminId) recipients.push(users.find(u => u.id === complaint.assignedAdminId));
      recipients.push(...admins, ...superAdmins);
    }

    const seen = new Set();
    for (const recipient of recipients.filter(Boolean)) {
      if (seen.has(recipient.id)) continue;
      seen.add(recipient.id);
      await db.notifications.insertOne({
        userId: recipient.id,
        title: `⚠️ L${levelDef.level} escalation — ${complaint.referenceId}`,
        message: `${reason}. Assigned to: ${complaint.assignedAdminName || 'Unassigned'}.`,
        type: 'sla_escalation',
        referenceId: complaint.referenceId,
        isRead: false,
      });
    }

    // 3. Email the committee / administrators (logged to console when SMTP is
    //    not configured). Each level widens the audience: L1 the officer,
    //    L2 the ICC committee, L3 the super admins as well.
    const mailRecipients = levelDef.level === 1
      ? (complaint.assignedAdminId ? [users.find(u => u.id === complaint.assignedAdminId)] : [])
      : levelDef.level === 2
      ? admins
      : [...admins, ...superAdmins];

    const mailed = new Set();
    for (const recipient of mailRecipients) {
      if (!recipient || !recipient.email || mailed.has(recipient.email)) continue;
      mailed.add(recipient.email);

      const result = await sendService('statutory_escalation', {
        to: recipient.email,
        data: {
          recipientName: recipient.name,
          level: levelDef.level,
          levels: LEVELS.length,
          referenceId: complaint.referenceId,
          title: complaint.title,
          status: complaint.status,
          reason,
          assignedTo: complaint.assignedAdminName || 'Unassigned',
          daysOverdue,
          escalatedAt: new Date().toISOString(),
        },
        meta: { complaintId: complaint.id, level: levelDef.level },
      });
      if (result && result.success && !result.dev) emailsSent++;
    }

    await logSystemAudit({
      action: 'SLA_ESCALATED',
      targetType: 'COMPLAINT',
      targetId: complaint.id,
      details: `L${levelDef.level} escalation for ${complaint.referenceId}: ${reason}`,
      actorName: `Escalation L${levelDef.level}`,
    });

    escalated.push({ referenceId: complaint.referenceId, level: levelDef.level, reason, daysOverdue });
  }

  if (escalated.length) {
    console.log(`[Escalation] ${escalated.length} case(s) escalated (${escalated.map(e => `${e.referenceId}:L${e.level}`).join(', ')})`);
  }
  return { scanned: open.length, escalated, emailsSent };
}

module.exports = { runEscalationSweep, LEVELS };
