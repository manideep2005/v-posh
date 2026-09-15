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

// Poll endpoints: the browser polls every 2–3s during a push/QR login wait
// (~45 calls per attempt). They get their own large bucket so a legitimate
// login never trips the strict 10/15min auth limiter.
const pollLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });


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

// Role enforcement: ROLE_OVERRIDES (env) assigns fixed roles to specific emails,
// beating domain auto-provisioning. Also REPAIRS existing accounts that were
// previously auto-provisioned with a lower role (e.g. a seeded super_admin who
// logged in via SSO before the seed ran and got stuck as 'faculty').
async function applyRoleOverride(user, email) {
  const forced = config.ROLE_OVERRIDES[email];
  if (user && forced && user.role !== forced) {
    await db.users.updateOne(user.id, { role: forced });
    user.role = forced;
  }
  return user;
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

    // Whitelisted emails bypass domain restrictions
    const isWhitelisted = config.WHITELIST_EMAILS.includes(normalizedEmail);

    // Enforce college domains (skip for whitelisted emails)
    const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
    const facultyDomains = config.ALLOWED_FACULTY_DOMAINS;
    const allAllowedDomains = [...studentDomains, ...facultyDomains];
    const emailDomain = normalizedEmail.split('@')[1];
    if (!isWhitelisted && !allAllowedDomains.includes(emailDomain)) {
      return res.status(403).json({
        success: false,
        message: `Only @${studentDomains.join(', @')} (students) and @${facultyDomains.join(', @')} (faculty) accounts are allowed.`
      });
    }

    // Determine role from domain (whitelisted emails with existing accounts keep their role)
    const autoRole = studentDomains.includes(emailDomain) ? 'student' : 'faculty';

    // Check if account is disabled
    let user = await db.users.findOne({ email: normalizedEmail });
    user = await applyRoleOverride(user, normalizedEmail);
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

    // Whitelisted emails bypass domain restrictions
    const isWhitelisted = config.WHITELIST_EMAILS.includes(normalizedEmail);

    // Enforce college domains (skip for whitelisted emails)
    const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
    const facultyDomains = config.ALLOWED_FACULTY_DOMAINS;
    const allAllowedDomains = [...studentDomains, ...facultyDomains];
    const emailDomain = normalizedEmail.split('@')[1];
    if (!isWhitelisted && !allAllowedDomains.includes(emailDomain)) {
      return res.status(403).json({
        success: false,
        message: `Only @${studentDomains.join(', @')} (students) and @${facultyDomains.join(', @')} (faculty) accounts are allowed.`
      });
    }

    // Determine role from domain (whitelisted emails with existing accounts keep their role)
    const autoRole = studentDomains.includes(emailDomain) ? 'student' : 'faculty';

    // Check existing user
    let user = await db.users.findOne({ email: normalizedEmail });
    user = await applyRoleOverride(user, normalizedEmail);
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

// Lazy singleton — recreated when env config changes.
let _kratosClient = null;
let _kratosClientKey = null;
function getKratosClient() {
  // Read directly from process.env so changes after startup are picked up
  const apiKey = process.env.KRATOSID_API_KEY || config.KRATOSID_API_KEY;
  const productId = process.env.KRATOSID_PRODUCT_ID || config.KRATOSID_PRODUCT_ID;
  const baseUrl = process.env.KRATOSID_BASE_URL || config.KRATOSID_BASE_URL;
  const appName = process.env.KRATOSID_APP_NAME || config.KRATOSID_APP_NAME;
  const key = `${apiKey}:${productId}:${baseUrl}`;
  if (_kratosClient && _kratosClientKey === key) return _kratosClient;
  if (!apiKey || !productId) {
    throw new Error('KratosID is not configured. Set KRATOSID_API_KEY and KRATOSID_PRODUCT_ID.');
  }
  _kratosClient = new KratosIDClient({
    apiKey,
    productId,
    appName,
    baseUrl,
  });
  _kratosClientKey = key;
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
    user = await applyRoleOverride(user, normalizedEmail);
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
      // Auto-detect role from domain
      const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
      const facultyDomains = config.ALLOWED_FACULTY_DOMAINS;
      const emailDomain = normalizedEmail.split('@')[1];
      const autoRole = studentDomains.includes(emailDomain) ? 'student' : facultyDomains.includes(emailDomain) ? 'faculty' : 'student';
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
      logAuditAction(req, autoRole === 'student' ? 'STUDENT_REGISTERED_KRATOSID' : 'FACULTY_REGISTERED_KRATOSID', 'USER', user.id,
        `${autoRole} auto-registered via KratosID: ${user.email}`);
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

// ─── KratosID Push Login (client-side polling) ────────────────────────────────
// Two-step flow (avoids Vercel serverless timeout):
//   1. POST /auth/kratosid/push/start  { email }  → sends push, returns request token (fast)
//   2. POST /auth/kratosid/push/poll   { token, email }  → polls KratosID for approval

// Pending push requests stored via db module (survives Vercel serverless cold starts).
// Each entry auto-expires after 2 minutes — checked at poll time.

router.post('/kratosid/push/start', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists and is not disabled
    const existingUser = await db.users.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
    }

    // Send push via KratosID (just the initial request, no polling)
    const kratos = getKratosClient();
    let pushToken;
    try {
      // We call the raw POST to /add_request and capture the token
      const resp = await kratos._post('/add_request', { email: normalizedEmail, data: '0000', requester: config.KRATOSID_APP_NAME });
      if (!resp.ok) {
        const text = await resp.text();
        const code = resp.status === 403 ? KratosIDError.NO_PRODUCT_ACCESS : KratosIDError.REQUEST_FAILED;
        throw new KratosIDError(`Failed to send push: ${text}`, resp.status, code);
      }
      const tokenText = (await resp.text()).trim();
      if (tokenText.startsWith('0000')) {
        throw new KratosIDError('User not found or not registered on KratosID', 0, KratosIDError.USER_NOT_FOUND);
      }
      pushToken = tokenText.slice(0, 36);
    } catch (kratosErr) {
      if (kratosErr.code === KratosIDError.USER_NOT_FOUND) {
        return res.status(404).json({ success: false, code: 'KRATOSID_USER_NOT_FOUND', message: 'This email is not registered on KratosID.' });
      }
      if (kratosErr.code === KratosIDError.NO_PRODUCT_ACCESS) {
        return res.status(403).json({ success: false, code: 'KRATOSID_NO_PRODUCT_ACCESS', message: 'This email is not associated with this KratosID product.' });
      }
      throw kratosErr;
    }

    // Store the push token with email for polling (DB-backed, works on Vercel serverless)
    await db.pendingPushes.insertOne({
      id: pushToken,
      email: normalizedEmail,
      createdAt: new Date().toISOString()
    });

    // Best-effort cleanup of stale entries (older than 3 minutes)
    try {
      const stale = new Date(Date.now() - 180000).toISOString();
      const all = await db.pendingPushes.find({});
      for (const p of all) {
        if (p.createdAt && p.createdAt < stale) await db.pendingPushes.deleteOne(p.id);
      }
    } catch (_) { /* ignore cleanup errors */ }

    res.json({ success: true, token: pushToken, message: 'Push notification sent. Check your KratosID app.' });
  } catch (err) {
    console.error('Push start error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send push notification.' });
  }
});

router.post('/kratosid/push/poll', pollLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Push token required.' });

    let pending = await db.pendingPushes.findOne({ id: token });
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Push request expired or not found.' });
    }
    // Auto-expire entries older than 2 minutes
    if (pending.createdAt && (Date.now() - new Date(pending.createdAt).getTime()) > 120000) {
      await db.pendingPushes.deleteOne(token);
      return res.status(404).json({ success: false, message: 'Push request expired or not found.' });
    }

    const kratos = getKratosClient();
    // KratosID's push itself only lives ~30s on their side. Poll with the
    // CURRENT push token (it may have been auto-re-sent) so the overall
    // 90-second approval window survives multiple push lifetimes.
    const activeToken = pending.currentPushToken || token;
    const resp = await kratos._post('/get_data', { token: activeToken });
    const status = (await resp.text()).trim();

    if (status.startsWith('pending')) {
      return res.json({ success: false, approved: false, status: 'pending' });
    }
    if (status.startsWith('expired') || status === 'Authorization denied') {
      await db.pendingPushes.deleteOne(token);
      return res.json({ success: false, approved: false, status: 'denied', message: 'Push denied by user.' });
    }
    if (status.startsWith('Authorization timeout')) {
      // Auto-resend the push (up to 2 resends ≈ 30s + 30s + 30s = 90s total)
      // instead of dying at KratosID's ~30s single-push lifetime.
      const resendCount = pending.resendCount || 0;
      if (resendCount < 2) {
        try {
          const resend = await kratos._post('/add_request', { email: pending.email, data: '0000', requester: config.KRATOSID_APP_NAME });
          const newText = (await resend.text()).trim();
          if (resend.ok && !newText.startsWith('0000')) {
            await db.pendingPushes.updateOne(token, {
              currentPushToken: newText.slice(0, 36),
              resendCount: resendCount + 1
            });
            return res.json({ success: false, approved: false, status: 'pending', resent: true });
          }
        } catch (_) { /* fall through to final timeout below */ }
      }
      await db.pendingPushes.deleteOne(token);
      return res.json({ success: false, approved: false, status: 'timeout', message: 'Push timed out.' });
    }

    // Try to parse as approved data
    let approved = false;
    try {
      const data = JSON.parse(status);
      if (Array.isArray(data) && data.length > 0) approved = true;
      if (data && data.Verification) approved = true;
    } catch (_) {}

    if (!approved) {
      await db.pendingPushes.deleteOne(token);
      return res.json({ success: false, approved: false, status: 'unknown', message: 'Unexpected response from KratosID.' });
    }

    // Approved! Issue JWT
    await db.pendingPushes.deleteOne(token);
    const normalizedEmail = pending.email;
    const localPart = normalizedEmail.split('@')[0];
    let user = await db.users.findOne({ email: normalizedEmail });
    user = await applyRoleOverride(user, normalizedEmail);

    // Role-downgrade guard: some privileged accounts (e.g. super admin) live on
    // a faculty domain but were seeded directly in the DB. Before auto-provisioning
    // a brand-new 'faculty' account, also match by employeeId / studentId so an
    // existing super_admin/admin record is found and its real role is preserved.
    if (!user) {
      user = await db.users.findOne({ employeeId: localPart.toUpperCase() });
    }
    if (!user) {
      user = await db.users.findOne({ studentId: localPart.toUpperCase() });
    }

    if (!user) {
      // Auto-detect role from domain
      const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
      const facultyDomains = config.ALLOWED_FACULTY_DOMAINS;
      const emailDomain = normalizedEmail.split('@')[1];
      const autoRole = studentDomains.includes(emailDomain) ? 'student' : facultyDomains.includes(emailDomain) ? 'faculty' : 'student';

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
      logAuditAction(req, autoRole === 'student' ? 'STUDENT_REGISTERED_KRATOSID' : 'FACULTY_REGISTERED_KRATOSID', 'USER', user.id,
        `${autoRole} auto-registered via KratosID push: ${user.email}`);
    } else {
      // Keep the account email in sync when matched via employeeId/studentId
      if (user.email !== normalizedEmail) {
        await db.users.updateOne(user.id, { email: normalizedEmail });
      }
      await db.users.updateOne(user.id, { lastActiveAt: new Date().toISOString() });
      logAuditAction(req, 'USER_LOGIN_KRATOSID', 'USER', user.id, `KratosID push login: ${user.name} (${user.role})`);
    }

    return res.json({
      success: true,
      approved: true,
      message: 'KratosID authentication approved.',
      token: signToken(user),
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Push poll error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify push status.' });
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

router.post('/kratosid/qr/poll', pollLimiter, async (req, res) => {
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
    const localPart = normalizedEmail.split('@')[0];
    let user = await db.users.findOne({ email: normalizedEmail });
    user = await applyRoleOverride(user, normalizedEmail);
    if (user && user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Account disabled.' });
    }

    // Role-downgrade guard (same as push poll): match seeded accounts by
    // employeeId / studentId before auto-provisioning a lower role.
    if (!user) {
      user = await db.users.findOne({ employeeId: localPart.toUpperCase() });
    }
    if (!user) {
      user = await db.users.findOne({ studentId: localPart.toUpperCase() });
    }

    if (!user) {
      // Auto-provision based on domain
      const studentDomains = config.ALLOWED_STUDENT_DOMAINS;
      const emailDomain = normalizedEmail.split('@')[1];
      const autoRole = studentDomains.includes(emailDomain) ? 'student' : 'faculty';

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
      if (user.email !== normalizedEmail) {
        await db.users.updateOne(user.id, { email: normalizedEmail });
      }
      await db.users.updateOne(user.id, { lastActiveAt: new Date().toISOString() });
      logAuditAction(req, 'USER_LOGIN_QR', 'USER', user.id, `QR login: ${user.name} (${user.role})`);
    }

    return res.json({ success: true, message: 'QR login approved.', token: signToken(user), user: sanitizeUser(user) });
  } catch (err) {
    console.error('QR poll error:', err);
    res.status(500).json({ success: false, message: 'Server error during QR login.' });
  }
});

// ─── Profile Picture Upload ──────────────────────────────────────────────────
const multer = require('multer');
const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed for profile pictures.'));
  }
});

router.post('/profile-picture', authenticateToken, profileUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided.' });

    const { GridFSBucket } = require('mongodb');
    const crypto = require('crypto');
    const pathMod = require('path');
    let avatarUrl = '';

    if (db.getEngineName() === 'mongodb' && db.getMongoDb()) {
      const bucket = new GridFSBucket(db.getMongoDb(), { bucketName: 'avatars' });
      const storedName = `avatar-${req.user.id}-${Date.now()}${pathMod.extname(req.file.originalname)}`;
      await new Promise((resolve, reject) => {
        const stream = bucket.openUploadStream(storedName, { contentType: req.file.mimetype });
        stream.on('error', reject);
        stream.on('finish', () => { avatarUrl = `/api/auth/avatar/${stream.id}`; resolve(); });
        stream.end(req.file.buffer);
      });
    } else {
      // Fallback: store as base64 data URL
      avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await db.users.updateOne(req.user.id, { avatar: avatarUrl });
    logAuditAction(req, 'PROFILE_PICTURE_UPDATED', 'USER', req.user.id, 'Profile picture updated');

    res.json({ success: true, message: 'Profile picture updated.', avatar: avatarUrl });
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload profile picture.' });
  }
});

module.exports = router;
