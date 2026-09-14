const db = require('../db');
const { logAuditAction } = require('../middleware/audit');
const { sendEmail } = require('./email');

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

// Auto-escalate complaints that have breached SLA
async function checkAndEscalate() {
  try {
    const complaints = await db.complaints.find();
    const now = new Date();
    let escalated = 0;

    for (const complaint of complaints) {
      if (complaint.status === 'Resolved') continue;

      const sla = getSLAStatus(complaint);
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

      escalated++;
    }

    if (escalated > 0) {
      console.log(`[SLA] Auto-escalated ${escalated} complaint(s)`);
    }
    return escalated;
  } catch (err) {
    console.error('[SLA] Auto-escalation error:', err);
    return 0;
  }
}

module.exports = { getSLAStatus, checkAndEscalate, SLA_THRESHOLDS };
