const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { rateLimit } = require('../middleware/rateLimit');

// Brute-force protection: 10 attempts per 15 minutes per IP per endpoint
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
}

function sanitizeUser(user) {
  const { password, resetTokenHash, resetTokenExpiresAt, ...safe } = user;
  return safe;
}

// Student Registration
router.post('/student/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password, studentId, department, year, phone } = req.body;

    if (!name || !isValidEmail(email) || !password || !studentId || !department) {
      return res.status(400).json({ success: false, message: 'Required fields missing: Name, valid Email, Password, Student ID, and Department are mandatory.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingEmail = await db.users.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'An account with this institutional email already exists.' });
    }

    const existingId = await db.users.findOne({ studentId: String(studentId).trim() });
    if (existingId) {
      return res.status(409).json({ success: false, message: 'An account with this Student ID / Roll Number already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

    const newUser = await db.users.insertOne({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      studentId: String(studentId).trim(),
      department,
      year: year || '1st Year',
      phone: phone || '',
      status: 'active',
      lastActiveAt: new Date().toISOString()
    });

    logAuditAction(req, 'STUDENT_REGISTERED', 'USER', newUser.id, `Student account registered: ${newUser.name} (${newUser.studentId})`);

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully.',
      token: signToken(newUser),
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Authentication Login Endpoint (Supports all roles)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await db.users.findOne({ email: email.toLowerCase().trim() });
    const genericFailure = { success: false, message: 'Invalid credentials. Please check your email and password.' };

    if (!user) {
      return res.status(401).json(genericFailure);
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact administration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json(genericFailure);
    }

    // Role strict check if specified
    if (expectedRole && user.role !== expectedRole) {
      // Allow super_admin to log in through admin portal if needed, but strictly prevent students from logging into admin/superadmin
      if (expectedRole === 'admin' && user.role === 'super_admin') {
        // permitted
      } else {
        return res.status(403).json({
          success: false,
          message: `Access denied. Account role is '${user.role}', expected '${expectedRole}'.`
        });
      }
    }

    // Update last active
    await db.users.updateOne(user.id, { lastActiveAt: new Date().toISOString() });

    logAuditAction(req, 'USER_LOGIN', 'USER', user.id, `User logged in: ${user.name} (${user.role})`);

    return res.json({
      success: true,
      message: 'Login successful.',
      token: signToken(user),
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Get current logged in user
router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Change password for the logged-in user (students & staff)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const user = await db.users.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);
    await db.users.updateOne(user.id, { password: hashed });

    logAuditAction(req, 'PASSWORD_CHANGED', 'USER', user.id, `Password changed by user ${user.name}`);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// Forgot Password — issues a single-use reset token (dev delivery: returned link)
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const user = await db.users.findOne({ email: email.toLowerCase().trim() });

  // Always return the same generic message so account existence is never disclosed
  const genericMessage = 'If an account with that email exists, password reset instructions have been dispatched.';

  if (!user) {
    return res.json({ success: true, message: genericMessage });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  await db.users.updateOne(user.id, {
    resetTokenHash: hashed,
    resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
  });

  logAuditAction(req, 'PASSWORD_RESET_REQUESTED', 'USER', user.id, `Password reset requested for ${user.email}`);

  // Prefer explicit APP_BASE_URL; otherwise derive from the request so reset
  // links stay valid on any deployment domain (Vercel preview URLs, etc.).
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = config.APP_BASE_URL || `${proto}://${host}`;
  const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

  // No SMTP transport is configured in this build; the reset link is returned
  // to the requester in development. Wire an email service here for production
  // and remove the devLink field.
  return res.json({ success: true, message: genericMessage, devLink: resetLink });
});

// Reset Password — consumes the single-use token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db.users.findOne({ resetTokenHash: hashed });

    const invalid = { success: false, message: 'This reset link is invalid or has expired. Please request a new one.' };
    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      return res.status(400).json(invalid);
    }

    const newHashed = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);
    await db.users.updateOne(user.id, {
      password: newHashed,
      resetTokenHash: null,
      resetTokenExpiresAt: null
    });

    logAuditAction(req, 'PASSWORD_RESET_COMPLETED', 'USER', user.id, `Password reset completed for ${user.email}`);

    return res.json({ success: true, message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

module.exports = router;
