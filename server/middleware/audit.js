const db = require('../db');

// Fire-and-forget audit logging: an audit failure must never break the
// user-facing request, but errors are surfaced in server logs.
function logAuditAction(req, action, targetType, targetId, details) {
  db.auditLogs.insertOne({
    actorId: req.user ? req.user.id : 'SYSTEM',
    actorName: req.user ? req.user.name : 'System Event',
    actorRole: req.user ? req.user.role : 'system',
    action,
    targetType,
    targetId,
    details,
    ipAddress: req.ip || (req.connection && req.connection.remoteAddress) || '127.0.0.1'
  }).catch(err => console.error('Failed to log audit entry:', err.message));
}

module.exports = {
  logAuditAction
};
