const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Access token missing.' });
  }

  verifyAndAttach(token)
    .then(({ user }) => {
      req.user = user;
      next();
    })
    .catch(err => {
      if (err && err.status) {
        return res.status(err.status).json({ success: false, message: err.message });
      }
      return res.status(401).json({ success: false, message: 'Session expired or invalid token. Please log in again.' });
    });
}

async function verifyAndAttach(token) {
  const decoded = jwt.verify(token, config.JWT_SECRET);
  const user = await db.users.findById(decoded.id);

  if (!user) {
    throw Object.assign(new Error('Invalid session or user no longer exists.'), { status: 401 });
  }

  if (user.status === 'disabled') {
    throw Object.assign(new Error('Account disabled. Contact administration.'), { status: 403 });
  }

  // Accounts predating V-POSH IDs pick one up here; a no-op once it is set.
  const withPoshId = await db.users.ensurePoshId(user);

  // Attach user to request without sensitive credentials
  const { password, resetTokenHash, resetTokenExpiresAt, ...safeUser } = withPoshId;
  return { user: safeUser };
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden. Role '${req.user.role}' is not authorized to access this resource.` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
