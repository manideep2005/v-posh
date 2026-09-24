const db = require('../db');
const { chainEntry } = require('../services/ledger');

// Fire-and-forget audit logging: an audit failure must never break the
// user-facing request, but errors are surfaced in server logs.
// Each entry is hash-chained (see services/ledger.js) so the trail is
// tamper-evident.
function logAuditAction(req, action, targetType, targetId, details) {
  const entry = {
    actorId: req.user ? req.user.id : 'SYSTEM',
    actorName: req.user ? req.user.name : 'System Event',
    actorRole: req.user ? req.user.role : 'system',
    action,
    targetType,
    targetId,
    details,
    ipAddress: req.ip || (req.connection && req.connection.remoteAddress) || '127.0.0.1',
    createdAt: new Date().toISOString(),
  };

  chainEntry(entry)
    .then(chained => db.auditLogs.insertOne(chained))
    .catch(err => console.error('Failed to log audit entry:', err.message));
}

// Same trail, but for background work with no incoming request
// (SLA escalation sweeps, maintenance jobs).
async function logSystemAudit({ action, targetType, targetId, details, actorName = 'System Automation' }) {
  try {
    const entry = {
      actorId: 'SYSTEM',
      actorName,
      actorRole: 'system',
      action,
      targetType,
      targetId,
      details,
      ipAddress: 'internal',
      createdAt: new Date().toISOString(),
    };
    const chained = await chainEntry(entry);
    await db.auditLogs.insertOne(chained);
    return chained;
  } catch (err) {
    console.error('Failed to log system audit entry:', err.message);
    return null;
  }
}

module.exports = {
  logAuditAction,
  logSystemAudit,
};
