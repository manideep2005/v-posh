const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// Middleware: Strictly require Super Admin role
router.use(authenticateToken, requireRole(['super_admin']));

// Super Admin Overview Metrics
router.get('/dashboard', async (req, res) => {
  try {
    const allUsers = await db.users.find();
    const complaints = await db.complaints.find();
    const categories = await db.categories.find();
    const departments = await db.departments.find();

    const stats = {
      totalUsers: allUsers.length,
      studentsCount: allUsers.filter(u => u.role === 'student').length,
      adminsCount: allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
      totalComplaints: complaints.length,
      activeComplaints: complaints.filter(c => c.status !== 'Resolved').length,
      resolvedComplaints: complaints.filter(c => c.status === 'Resolved').length,
      auditLogsCount: await db.auditLogs.count()
    };

    // Complaints grouped by category
    const categoryStats = categories.map(cat => ({
      name: cat.name,
      count: complaints.filter(c => c.category === cat.name).length
    }));

    // Complaints grouped by department
    const departmentStats = departments.map(dept => ({
      name: dept.name,
      code: dept.code,
      count: complaints.filter(c => c.studentDept === dept.name).length
    }));

    const recentAuditLogs = (await db.auditLogs.find())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    res.json({
      success: true,
      stats,
      categoryStats,
      departmentStats,
      recentAuditLogs
    });
  } catch (err) {
    console.error('Super Admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load system metrics.' });
  }
});

// Admin Account Management - List Admins
router.get('/admins', async (req, res) => {
  try {
    const adminUsers = (await db.users.find())
      .filter(u => u.role === 'admin' || u.role === 'super_admin');

    // Attach current active workload count
    const adminsWithWorkload = await Promise.all(adminUsers.map(async ({ password, ...user }) => {
      const activeWorkload = await db.complaints.count(
        c => c.assignedAdminId === user.id && c.status !== 'Resolved'
      );
      return { ...user, activeWorkload };
    }));

    res.json({ success: true, admins: adminsWithWorkload });
  } catch (err) {
    console.error('Admin list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch administrative staff list.' });
  }
});

// Create / Provision New Admin Account
router.post('/admins', async (req, res) => {
  try {
    const { name, email, password, employeeId, department, designation, permissions } = req.body;

    if (!name || !email || !password || !employeeId) {
      return res.status(400).json({ success: false, message: 'Mandatory fields: Name, Email, Password, and Employee ID are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Initial password must be at least 8 characters long.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'A valid institutional email address is required.' });
    }

    const existingUser = await db.users.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

    const newAdmin = await db.users.insertOne({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin',
      employeeId,
      department: department || 'General Administration',
      designation: designation || 'ICC Member',
      status: 'active',
      permissions: permissions || ['manage_complaints', 'view_students'],
      lastActiveAt: null
    });

    logAuditAction(req, 'ADMIN_ACCOUNT_CREATED', 'USER', newAdmin.id, `Provisioned new admin account: ${name} (${employeeId})`);

    const { password: _, ...adminWithoutPassword } = newAdmin;
    res.status(201).json({
      success: true,
      message: `Admin account for ${name} provisioned successfully.`,
      admin: adminWithoutPassword
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ success: false, message: 'Failed to create admin account.' });
  }
});

// Enable / Disable Admin Account
router.put('/admins/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const targetAdmin = await db.users.findById(req.params.id);

    if (!targetAdmin) {
      return res.status(404).json({ success: false, message: 'Admin record not found.' });
    }

    if (targetAdmin.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Self-deactivation is prohibited.' });
    }

    await db.users.updateOne(targetAdmin.id, { status });

    logAuditAction(req, 'ADMIN_STATUS_CHANGED', 'USER', targetAdmin.id, `Changed admin status of ${targetAdmin.name} to ${status}`);

    res.json({ success: true, message: `Admin status set to ${status}.` });
  } catch (err) {
    console.error('Admin status error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle admin status.' });
  }
});

// Audit Logs Retrieval
router.get('/audit-logs', async (req, res) => {
  try {
    const { action, actorRole, search, page = 1, limit = 25 } = req.query;
    let logs = await db.auditLogs.find();

    if (action && action !== 'ALL') {
      logs = logs.filter(l => l.action === action);
    }
    if (actorRole && actorRole !== 'ALL') {
      logs = logs.filter(l => l.actorRole === actorRole);
    }
    if (search) {
      const q = String(search).toLowerCase();
      logs = logs.filter(l =>
        (l.actorName || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q)
      );
    }

    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const startIndex = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginated = logs.slice(startIndex, startIndex + parseInt(limit, 10));

    res.json({
      success: true,
      total: logs.length,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      logs: paginated
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to load audit trail logs.' });
  }
});

// System Settings Management
router.get('/settings', async (req, res) => {
  try {
    res.json({
      success: true,
      settings: await db.getSettings(),
      departments: await db.departments.find(),
      categories: await db.categories.find()
    });
  } catch (err) {
    console.error('Settings fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to load system settings.' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const updated = await db.updateSettings(req.body);
    logAuditAction(req, 'SYSTEM_SETTINGS_UPDATED', 'SETTINGS', 'SYSTEM', 'Updated system configurations & policies');
    res.json({ success: true, message: 'System settings saved successfully.', settings: updated });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update system settings.' });
  }
});

module.exports = router;
