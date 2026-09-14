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

// Admin Account Management - List Admins (+ all non-student staff)
router.get('/admins', async (req, res) => {
  try {
    const includeAll = req.query.includeAll === 'true';
    const adminUsers = (await db.users.find())
      .filter(u => includeAll || u.role === 'admin' || u.role === 'super_admin' || u.role === 'faculty');

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

// Promote / Demote Role (faculty ↔ admin)
router.put('/admins/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['admin', 'faculty', 'super_admin', 'student'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    const targetUser = await db.users.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role.' });
    }

    const oldRole = targetUser.role;
    await db.users.updateOne(targetUser.id, { role });

    const roleLabels = { student: 'Student', faculty: 'Faculty', admin: 'Admin', super_admin: 'Super Admin' };
    logAuditAction(req, 'USER_ROLE_CHANGED', 'USER', targetUser.id,
      `Changed role of ${targetUser.name} from ${roleLabels[oldRole]} to ${roleLabels[role]}`);

    res.json({ success: true, message: `${targetUser.name} is now ${roleLabels[role]}.` });
  } catch (err) {
    console.error('Role change error:', err);
    res.status(500).json({ success: false, message: 'Failed to change user role.' });
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

// ─── Workload Analytics & Officer Performance ───────────────────────────────

router.get('/workload', async (req, res) => {
  try {
    const officers = (await db.users.find())
      .filter(u => u.role === 'admin' || u.role === 'super_admin');
    const allComplaints = await db.complaints.find();
    const allHistory = await db.statusHistory.find();
    const now = new Date();

    // Officer performance metrics
    const officerMetrics = officers.map(officer => {
      const assigned = allComplaints.filter(c => c.assignedAdminId === officer.id);
      const active = assigned.filter(c => c.status !== 'Resolved');
      const resolved = assigned.filter(c => c.status === 'Resolved');
      const urgent = assigned.filter(c => c.priority === 'Urgent' && c.status !== 'Resolved');

      // Average resolution time (hours) for resolved cases
      let avgResolutionHours = null;
      if (resolved.length > 0) {
        const resolutionTimes = resolved.map(c => {
          const created = new Date(c.createdAt);
          const resolvedEntry = allHistory.find(
            h => h.complaintId === c.id && h.newStatus === 'Resolved'
          );
          const resolvedAt = resolvedEntry ? new Date(resolvedEntry.createdAt) : now;
          return (resolvedAt - created) / (1000 * 60 * 60);
        });
        avgResolutionHours = Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length);
      }

      // SLA breaches (>7 days for unresolved)
      const slaBreaches = active.filter(c => {
        const created = new Date(c.createdAt);
        return (now - created) > (7 * 24 * 60 * 60 * 1000);
      }).length;

      // Cases received per status
      const statusBreakdown = {};
      assigned.forEach(c => {
        statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;
      });

      return {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        role: officer.role,
        department: officer.department || 'N/A',
        designation: officer.designation || 'ICC Member',
        totalAssigned: assigned.length,
        activeCases: active.length,
        resolvedCases: resolved.length,
        urgentCases: urgent.length,
        avgResolutionHours,
        slaBreaches,
        resolutionRate: assigned.length > 0 ? Math.round((resolved.length / assigned.length) * 100) : 0,
        statusBreakdown,
      };
    });

    // Sort by active cases descending
    officerMetrics.sort((a, b) => b.activeCases - a.activeCases);

    // System-wide workload distribution
    const statusDistribution = {};
    allComplaints.forEach(c => {
      statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
    });

    const priorityDistribution = {};
    allComplaints.forEach(c => {
      priorityDistribution[c.priority] = (priorityDistribution[c.priority] || 0) + 1;
    });

    // Unassigned cases
    const unassigned = allComplaints.filter(c => !c.assignedAdminId && c.status !== 'Resolved').length;

    // Overall metrics
    const totalResolved = allComplaints.filter(c => c.status === 'Resolved').length;
    const totalActive = allComplaints.filter(c => c.status !== 'Resolved').length;
    const totalSlaBreaches = allComplaints.filter(c => {
      const created = new Date(c.createdAt);
      return c.status !== 'Resolved' && (now - created) > (7 * 24 * 60 * 60 * 1000);
    }).length;

    // Complaints received per month (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const count = allComplaints.filter(c => {
        const cd = new Date(c.createdAt);
        return cd >= d && cd <= monthEnd;
      }).length;
      const resolvedCount = allComplaints.filter(c => {
        const cd = new Date(c.createdAt);
        return cd >= d && cd <= monthEnd && c.status === 'Resolved';
      }).length;
      monthlyData.push({ month: monthName, total: count, resolved: resolvedCount });
    }

    res.json({
      success: true,
      officerMetrics,
      systemOverview: {
        totalOfficers: officers.length,
        totalComplaints: allComplaints.length,
        totalActive,
        totalResolved,
        unassigned,
        totalSlaBreaches,
        overallResolutionRate: allComplaints.length > 0 ? Math.round((totalResolved / allComplaints.length) * 100) : 0,
        statusDistribution,
        priorityDistribution,
      },
      monthlyData,
    });
  } catch (err) {
    console.error('Workload analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to load workload analytics.' });
  }
});

// ─── System Announcements ──────────────────────────────────────────────────

router.get('/announcements', async (req, res) => {
  try {
    const collection = db.announcements;
    if (!collection) return res.json({ success: true, announcements: [] });
    const announcements = (await collection.find()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, announcements });
  } catch (err) {
    res.json({ success: true, announcements: [] });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const { title, message, targetRoles, priority } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }
    const collection = db.announcements;
    if (!collection) return res.status(500).json({ success: false, message: 'Announcements not available.' });

    const announcement = await collection.insertOne({
      title: String(title).trim(),
      message: String(message).trim(),
      targetRoles: targetRoles || ['student', 'faculty', 'admin', 'super_admin'],
      priority: priority || 'normal',
      authorId: req.user.id,
      authorName: req.user.name,
      isActive: true,
      createdAt: new Date().toISOString()
    });

    logAuditAction(req, 'ANNOUNCEMENT_CREATED', 'SYSTEM', announcement.id, `Announcement: ${title}`);

    res.status(201).json({ success: true, message: 'Announcement published.', announcement });
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ success: false, message: 'Failed to create announcement.' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const collection = db.announcements;
    if (!collection) return res.status(500).json({ success: false, message: 'Announcements not available.' });
    await collection.deleteOne(req.params.id);
    res.json({ success: true, message: 'Announcement removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete announcement.' });
  }
});

module.exports = router;
