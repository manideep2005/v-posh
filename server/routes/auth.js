const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
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
      // Allow super_admin and faculty to log in through admin portal
      if (expectedRole === 'admin' && (user.role === 'super_admin' || user.role === 'faculty')) {
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

// ─── Google OAuth — VIT-AP Student Sign-In ──────────────────────────────────
// Accepts a Google ID token from the frontend, verifies it server-side,
// enforces @vitapstudent.ac.in domain, then auto-provisions or logs in the
// student and returns our standard JWT (same as /login).
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required.' });
    }

    if (!config.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ success: false, message: 'Google Sign-In is not configured on this server.' });
    }

    // Verify the token with Google
    const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Google token. Please try signing in again.' });
    }

    const { email, name, picture, sub: googleId } = payload;
    const normalizedEmail = (email || '').toLowerCase().trim();

    // Enforce college domains: students = @vitapstudent.ac.in, faculty = @vitap.ac.in
    const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
    const facultyDomains = config.ALLOWED_FACULTY_DOMAINS;
    const allAllowedDomains = [...studentDomains, ...facultyDomains];
    const emailDomain = normalizedEmail.split('@')[1];
    if (!allAllowedDomains.includes(emailDomain)) {
      return res.status(403).json({
        success: false,
        message: `Only @${studentDomains.join(', @')} (students) and @${facultyDomains.join(', @')} (faculty) accounts are allowed.`
      });
    }

    // Determine role from domain: @vitapstudent.ac.in → student, @vitap.ac.in → faculty
    const autoRole = studentDomains.includes(emailDomain) ? 'student' : 'faculty';

    // Check if account is disabled
    let user = await db.users.findOne({ email: normalizedEmail });
    if (user && user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact administration.' });
    }

    if (!user) {
      // Auto-provision account from Google profile
      const localPart = normalizedEmail.split('@')[0];
      const idMatch = localPart.match(/\.([a-z0-9]+)$/i);
      const derivedId = idMatch ? idMatch[1].toUpperCase() : localPart.toUpperCase();

      user = await db.users.insertOne({
        name: name || localPart,
        email: normalizedEmail,
        password: null,
        role: autoRole,
        studentId: autoRole === 'student' ? derivedId : '',
        employeeId: autoRole === 'faculty' ? derivedId : '',
        department: '',
        year: '',
        phone: '',
        googleId,
        avatar: picture || '',
        authProvider: 'google',
        status: 'active',
        lastActiveAt: new Date().toISOString()
      });

      logAuditAction(req, autoRole === 'student' ? 'STUDENT_REGISTERED_GOOGLE' : 'FACULTY_REGISTERED_GOOGLE', 'USER', user.id,
        `${autoRole} auto-registered via Google SSO: ${user.name} (${user.email})`);
    } else {
      // Existing user — patch Google fields if missing
      const updates = { lastActiveAt: new Date().toISOString() };
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar && picture) updates.avatar = picture;
      if (!user.authProvider) updates.authProvider = 'google';
      await db.users.updateOne(user.id, updates);

      logAuditAction(req, 'USER_LOGIN_GOOGLE', 'USER', user.id,
        `Google SSO login: ${user.name} (${user.email})`);
    }

    return res.json({
      success: true,
      message: 'Google sign-in successful.',
      token: signToken(user),
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Google OAuth error:', err);
    return res.status(500).json({ success: false, message: 'Server error during Google sign-in.' });
  }
});

// ─── Google OAuth via Access Token (implicit flow) ───────────────────────────
// Used when the frontend uses useGoogleLogin() which returns an access token.
// We call Google userinfo API server-side to get the email, then apply the
// same domain check and JWT issuance as the ID-token route above.
router.post('/google-access', authLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Access token is required.' });
    }

    // Verify the access token and get user profile from Google
    const profileRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!profileRes.ok) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Google token. Please try signing in again.' });
    }

    const profile = await profileRes.json();
    const { email, name, picture, sub: googleId } = profile;
    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Could not retrieve email from Google account.' });
    }

    // Enforce college domains: students = @vitapstudent.ac.in, faculty = @vitap.ac.in
    const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
    const facultyDomains = config.ALLOWED_FACULTY_DOMAINS;
    const allAllowedDomains = [...studentDomains, ...facultyDomains];
    const emailDomain = normalizedEmail.split('@')[1];
    if (!allAllowedDomains.includes(emailDomain)) {
      return res.status(403).json({
        success: false,
        message: `Only @${studentDomains.join(', @')} (students) and @${facultyDomains.join(', @')} (faculty) accounts are allowed.`
      });
    }

    // Determine role from domain
    const autoRole = studentDomains.includes(emailDomain) ? 'student' : 'faculty';

    // Check existing user
    let user = await db.users.findOne({ email: normalizedEmail });
    if (user && user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact administration.' });
    }

    if (!user) {
      const localPart = normalizedEmail.split('@')[0];
      const idMatch = localPart.match(/\.([a-z0-9]+)$/i);
      const derivedId = idMatch ? idMatch[1].toUpperCase() : localPart.toUpperCase();

      user = await db.users.insertOne({
        name: name || localPart,
        email: normalizedEmail,
        password: null,
        role: autoRole,
        studentId: autoRole === 'student' ? derivedId : '',
        employeeId: autoRole === 'faculty' ? derivedId : '',
        department: '',
        year: '',
        phone: '',
        googleId,
        avatar: picture || '',
        authProvider: 'google',
        status: 'active',
        lastActiveAt: new Date().toISOString()
      });

      logAuditAction(req, autoRole === 'student' ? 'STUDENT_REGISTERED_GOOGLE' : 'FACULTY_REGISTERED_GOOGLE', 'USER', user.id,
        `${autoRole} auto-registered via Google SSO: ${user.name} (${user.email})`);
    } else {
      const updates = { lastActiveAt: new Date().toISOString() };
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar && picture) updates.avatar = picture;
      if (!user.authProvider) updates.authProvider = 'google';
      await db.users.updateOne(user.id, updates);

      logAuditAction(req, 'USER_LOGIN_GOOGLE', 'USER', user.id,
        `Google SSO login: ${user.name} (${user.email})`);
    }

    return res.json({
      success: true,
      message: 'Google sign-in successful.',
      token: signToken(user),
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Google access-token OAuth error:', err);
    return res.status(500).json({ success: false, message: 'Server error during Google sign-in.' });
  }
});

// ─── KratosID Passwordless Auth ───────────────────────────────────────────────
// Uses the KratosID SDK from /javascript/src/index.js
// Flow:
//   1. POST /auth/kratosid/verify  { email }  → checks user exists in DB, then sends push to their KratosID app
//   2. Backend polls KratosID server (up to 55s) waiting for approval
//   3. Returns JWT on approval, or rejection reason
//
const { KratosIDClient, KratosIDError } = require('../../javascript/src/index.js');

// Lazy singleton — created on first use so missing keys don't crash startup
let _kratosClient = null;
function getKratosClient() {
  if (_kratosClient) return _kratosClient;
  if (!config.KRATOSID_API_KEY || !config.KRATOSID_PRODUCT_ID) {
    throw new Error('KratosID is not configured. Set KRATOSID_API_KEY and KRATOSID_PRODUCT_ID.');
  }
  _kratosClient = new KratosIDClient({
    apiKey: config.KRATOSID_API_KEY,
    productId: config.KRATOSID_PRODUCT_ID,
    appName: config.KRATOSID_APP_NAME,
    // Use explicit baseUrl — overrides environment so the correct prod endpoint is hit
    baseUrl: config.KRATOSID_BASE_URL,
  });
  return _kratosClient;
}

// POST /api/auth/kratosid/verify
// Sends a push-auth request to the user's KratosID mobile app and waits.
// Returns JWT immediately when approved (long-poll, ≤55s).
router.post('/kratosid/verify', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists in our DB
    let user = await db.users.findOne({ email: normalizedEmail });
    if (user && user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact administration.' });
    }
    // Send push via KratosID and wait for approval (this long-polls up to 55s)
    const kratos = getKratosClient();
    let result;
    try {
      result = await kratos.verifyUser(normalizedEmail, config.KRATOSID_APP_NAME);
    } catch (kratosErr) {
      if (kratosErr.code === KratosIDError.USER_NOT_FOUND) {
        return res.status(404).json({
          success: false,
          code: 'KRATOSID_USER_NOT_FOUND',
          message: 'This email is not registered on KratosID. Please install the KratosID app and register your email.'
        });
      }
      if (kratosErr.code === KratosIDError.NO_PRODUCT_ACCESS) {
        return res.status(403).json({
          success: false,
          code: 'KRATOSID_NO_PRODUCT_ACCESS',
          message: 'This email is not associated with this KratosID product. Please register on KratosID first.'
        });
      }
      throw kratosErr;
    }

    if (!result.approved) {
      const reasonMsg = result.reason === 'denied_by_user'
        ? 'Authentication denied. You rejected the request on your KratosID app.'
        : 'Authentication timed out. Please try again.';
      return res.status(401).json({ success: false, code: result.reason, message: reasonMsg });
    }

    // Approved — issue JWT
    if (!user) {
      // Auto-provision new account
      const localPart = normalizedEmail.split('@')[0];
      user = await db.users.insertOne({
        name: localPart,
        email: normalizedEmail,
        password: null,
        role: 'student',
        studentId: '',
        department: '',
        year: '',
        phone: '',
        authProvider: 'kratosid',
        status: 'active',
        lastActiveAt: new Date().toISOString()
      });
      logAuditAction(req, 'STUDENT_REGISTERED_KRATOSID', 'USER', user.id,
        `Student auto-registered via KratosID: ${user.email}`);
    } else {
      await db.users.updateOne(user.id, { lastActiveAt: new Date().toISOString() });
      logAuditAction(req, 'USER_LOGIN_KRATOSID', 'USER', user.id,
        `KratosID passwordless login: ${user.name} (${user.email})`);
    }

    return res.json({
      success: true,
      message: 'KratosID authentication approved.',
      token: signToken(user),
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('KratosID verify error:', err);
    return res.status(500).json({ success: false, message: 'Server error during KratosID authentication.' });
  }
});

// ─── KratosID QR Login ───────────────────────────────────────────────────────
// Two-step flow:
//   1. POST /auth/kratosid/qr/start → returns QR payload to render
//   2. POST /auth/kratosid/qr/poll  → long-polls until scan+approve

router.post('/kratosid/qr/start', authLimiter, async (req, res) => {
  try {
    const kratos = getKratosClient();
    const qrData = await kratos.startQrLogin();
    res.json({ success: true, ...qrData });
  } catch (err) {
    console.error('QR start error:', err);
    if (err.code === KratosIDError.NO_PRODUCT_ACCESS) {
      return res.status(403).json({ success: false, code: 'KRATOSID_NO_PRODUCT_ACCESS', message: 'KratosID product not configured.' });
    }
    res.status(500).json({ success: false, message: 'Failed to start QR login.' });
  }
});

router.post('/kratosid/qr/poll', authLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'QR token required.' });

    const kratos = getKratosClient();
    let result;
    try {
      result = await kratos.waitForQrLogin(token, { timeout: 85000 });
    } catch (kratosErr) {
      if (kratosErr.code === KratosIDError.NO_PRODUCT_ACCESS) {
        return res.status(403).json({ success: false, code: 'KRATOSID_NO_PRODUCT_ACCESS', message: 'KratosID product not configured.' });
      }
      throw kratosErr;
    }

    if (!result.approved) {
      const reasonMsg = result.reason === 'denied_by_user'
        ? 'QR login denied by user.'
        : 'QR login timed out or expired.';
      return res.status(401).json({ success: false, code: result.reason, message: reasonMsg });
    }

    // Extract email from QR approval (KratosID returns user info in the approval)
    let email = '';
    try {
      const parsed = JSON.parse(result.raw || '{}');
      email = parsed.email || parsed.user_email || '';
    } catch {}

    if (!email) {
      return res.status(400).json({ success: false, message: 'QR approval received but no email found. Ensure your KratosID app has your email set.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await db.users.findOne({ email: normalizedEmail });
    if (user && user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Account disabled.' });
    }

    if (!user) {
      // Auto-provision based on domain
      const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
      const emailDomain = normalizedEmail.split('@')[1];
      const autoRole = studentDomains.includes(emailDomain) ? 'student' : 'faculty';
      const localPart = normalizedEmail.split('@')[0];

      user = await db.users.insertOne({
        name: localPart,
        email: normalizedEmail,
        password: null,
        role: autoRole,
        studentId: autoRole === 'student' ? localPart.toUpperCase() : '',
        employeeId: autoRole === 'faculty' ? localPart.toUpperCase() : '',
        department: '',
        year: '',
        phone: '',
        authProvider: 'kratosid',
        status: 'active',
        lastActiveAt: new Date().toISOString()
      });
      logAuditAction(req, 'USER_REGISTERED_QR', 'USER', user.id, `QR login auto-provisioned: ${user.email}`);
    } else {
      await db.users.updateOne(user.id, { lastActiveAt: new Date().toISOString() });
      logAuditAction(req, 'USER_LOGIN_QR', 'USER', user.id, `QR login: ${user.name}`);
    }

    return res.json({ success: true, message: 'QR login approved.', token: signToken(user), user: sanitizeUser(user) });
  } catch (err) {
    console.error('QR poll error:', err);
    res.status(500).json({ success: false, message: 'Server error during QR login.' });
  }
});

module.exports = router;
