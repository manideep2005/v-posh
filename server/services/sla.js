const db = require('../db');
const config = require('../config');
const { logAuditAction } = require('../middleware/audit');
const { sendService } = require('./email');

// SLA thresholds (in hours)
const SLA_THRESHOLDS = {
  acknowledgement: 48,    // Acknowledge within 48 hours
  investigation: 168,     // Start investigation within 7 days
  resolution: 336,        // Resolve within 14 days (statutory)
};

// Check SLA status for a complaint
function getSLAStatus(complaint) {
  if (complaint.status === 'Resolved') {
    return { status: 'completed', message: 'Case resolved', hoursRemaining: null, deadline: null };
  }

  const now = new Date();
  const created = new Date(complaint.createdAt);
  const elapsedHours = (now - created) / (1000 * 60 * 60);

  let deadline, threshold, label;

  switch (complaint.status) {
    case 'Submitted':
      deadline = new Date(created.getTime() + SLA_THRESHOLDS.acknowledgement * 60 * 60 * 1000);
      threshold = SLA_THRESHOLDS.acknowledgement;
      label = 'Acknowledgement';
      break;
    case 'Acknowledged':
      deadline = new Date(created.getTime() + SLA_THRESHOLDS.investigation * 60 * 60 * 1000);
      threshold = SLA_THRESHOLDS.investigation;
      label = 'Investigation Start';
      break;
    case 'Under Review':
    case 'Investigation':
    case 'Action Taken':
      deadline = new Date(created.getTime() + SLA_THRESHOLDS.resolution * 60 * 60 * 1000);
      threshold = SLA_THRESHOLDS.resolution;
      label = 'Resolution';
      break;
    default:
      return { status: 'unknown', message: 'Unknown status', hoursRemaining: null, deadline: null };
  }

  const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
  const hoursElapsed = elapsedHours;
  const pctUsed = Math.min(100, Math.round((hoursElapsed / threshold) * 100));

  let slaStatus;
  if (hoursRemaining <= 0) {
    slaStatus = 'breached';
  } else if (hoursRemaining <= 24) {
    slaStatus = 'critical';
  } else if (hoursRemaining <= 48) {
    slaStatus = 'warning';
  } else {
    slaStatus = 'on-track';
  }

  return {
    status: slaStatus,
    label,
    deadline: deadline.toISOString(),
    hoursRemaining: Math.max(0, Math.round(hoursRemaining)),
    hoursElapsed: Math.round(hoursElapsed),
    threshold,
    pctUsed,
    message: slaStatus === 'breached'
      ? `SLA breached — ${label} deadline exceeded by ${Math.abs(Math.round(hoursRemaining))}h`
      : slaStatus === 'critical'
      ? `${hoursRemaining}h remaining for ${label}`
      : slaStatus === 'warning'
      ? `${hoursRemaining}h remaining — approaching deadline`
      : `On track — ${hoursRemaining}h remaining for ${label}`,
  };
}

/**
 * Has this service already emailed about this complaint in the last `hours`?
 * Keeps the hourly SLA sweep from repeating the same warning to an officer.
 */
async function wasEmailedRecently(service, complaintId, hours) {
  try {
    const since = Date.now() - hours * 60 * 60 * 1000;
    const entries = await db.emailLog.find(e =>
      e.service === service &&
      e.meta && e.meta.complaintId === complaintId &&
      new Date(e.createdAt).getTime() >= since
    );
    return entries.length > 0;
  } catch {
    return false;
  }
}

/** Escalating SLA warnings go to the assigned officer and the ICC mailbox. */
async function warningRecipients(complaint) {
  const recipients = [];
  if (complaint.assignedAdminId) {
    const officer = await db.users.findById(complaint.assignedAdminId);
    if (officer && officer.email) recipients.push({ email: officer.email, name: officer.name });
  }
  if (!recipients.length && config.ICC_NOTIFICATION_EMAIL) {
    recipients.push({ email: config.ICC_NOTIFICATION_EMAIL, name: 'ICC Committee' });
  }
  return recipients;
}

// Auto-escalate complaints that have breached SLA
async function checkAndEscalate() {
  try {
    const complaints = await db.complaints.find();
    const now = new Date();
    let escalated = 0;
    let warned = 0;

    for (const complaint of complaints) {
      if (complaint.status === 'Resolved') continue;

      const sla = getSLAStatus(complaint);

      // 1) Deadline approaching — warn the owner once per 24h window.
      if (sla.status === 'critical' || sla.status === 'warning') {
        if (!(await wasEmailedRecently('sla_warning', complaint.id, 24))) {
          for (const recipient of await warningRecipients(complaint)) {
            sendService('sla_warning', {
              to: recipient.email,
              data: {
                officerName: recipient.name,
                referenceId: complaint.referenceId,
                title: complaint.title,
                slaLabel: sla.label,
                deadline: sla.deadline,
                hoursRemaining: sla.hoursRemaining,
                status: complaint.status,
              },
              meta: { complaintId: complaint.id },
            }).catch(err => console.error('[Email] SLA warning failed:', err.message));
          }
          warned++;
        }
        continue;
      }

      if (sla.status !== 'breached') continue;

      // Check if already escalated recently (within 24 hours)
      const recentHistory = await db.statusHistory.find({ complaintId: complaint.id });
      const recentEscalation = recentHistory.find(h =>
        h.comment && h.comment.includes('SLA breached') &&
        (now - new Date(h.createdAt)) < 24 * 60 * 60 * 1000
      );
      if (recentEscalation) continue;

      // Create escalation entry in status history
      await db.statusHistory.insertOne({
        complaintId: complaint.id,
        previousStatus: complaint.status,
        newStatus: complaint.status, // Status doesn't change, just escalation notice
        changedById: 'SYSTEM',
        changedByName: 'System Auto-Escalation',
        changedByRole: 'system',
        comment: `⚠️ SLA breached for ${sla.label}. Deadline was ${new Date(sla.deadline).toLocaleString()}. Case requires immediate attention.`
      });

      // Notify the assigned admin
      if (complaint.assignedAdminId) {
        await db.notifications.insertOne({
          userId: complaint.assignedAdminId,
          title: '⚠️ SLA Breach Alert',
          message: `Complaint ${complaint.referenceId} has breached the SLA for ${sla.label}. Immediate action required.`,
          type: 'sla_breach',
          referenceId: complaint.referenceId,
          isRead: false
        });
      }

      // Notify super admins
      const superAdmins = await db.users.find({ role: 'super_admin', status: 'active' });
      for (const sa of superAdmins) {
        await db.notifications.insertOne({
          userId: sa.id,
          title: '⚠️ SLA Breach — System Alert',
          message: `Complaint ${complaint.referenceId} (${complaint.title}) has breached SLA for ${sla.label}. Assigned to: ${complaint.assignedAdminName || 'Unassigned'}.`,
          type: 'sla_breach',
          referenceId: complaint.referenceId,
          isRead: false
        });
      }

      // Email the breach to the officer and every super admin (one mail each).
      const breachRecipients = new Map();
      if (complaint.assignedAdminId) {
        const officer = await db.users.findById(complaint.assignedAdminId);
        if (officer && officer.email) breachRecipients.set(officer.email, officer.name);
      }
      for (const sa of superAdmins) {
        if (sa.email) breachRecipients.set(sa.email, sa.name);
      }
      if (config.ICC_NOTIFICATION_EMAIL) breachRecipients.set(config.ICC_NOTIFICATION_EMAIL, 'ICC Committee');

      const overdueHours = Math.max(0, Math.round(
        (now - new Date(sla.deadline)) / (1000 * 60 * 60)
      ));

      for (const [email, name] of breachRecipients) {
        sendService('sla_breach_alert', {
          to: email,
          data: {
            recipientName: name,
            referenceId: complaint.referenceId,
            title: complaint.title,
            slaLabel: sla.label,
            deadline: sla.deadline,
            daysOverdue: Math.floor(overdueHours / 24),
            overdueLabel: `${overdueHours}h past the ${sla.label} deadline`,
            assignedTo: complaint.assignedAdminName || 'Unassigned',
            status: complaint.status,
          },
          meta: { complaintId: complaint.id },
        }).catch(err => console.error('[Email] SLA breach alert failed:', err.message));
      }

      escalated++;
    }

    if (escalated > 0) {
      console.log(`[SLA] Auto-escalated ${escalated} complaint(s)`);
    }
    if (warned > 0) {
      console.log(`[SLA] Sent deadline warnings for ${warned} complaint(s)`);
    }
    return escalated;
  } catch (err) {
    console.error('[SLA] Auto-escalation error:', err);
    return 0;
  }
}

module.exports = { getSLAStatus, checkAndEscalate, SLA_THRESHOLDS };
