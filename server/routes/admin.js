const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// Middleware to enforce Admin / Super Admin access
router.use(authenticateToken, requireRole(['admin', 'super_admin']));

// Whitelisted workflow statuses — clients may not inject arbitrary values
const VALID_STATUSES = ['Submitted', 'Acknowledged', 'Under Review', 'Investigation', 'Action Taken', 'Resolved'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

// Admin Dashboard Operational Overview
router.get('/dashboard', async (req, res) => {
  try {
    const complaints = await db.complaints.find();

    const total = complaints.length;
    const newComplaints = complaints.filter(c => c.status === 'Submitted').length;
    const underReview = complaints.filter(c => c.status === 'Under Review' || c.status === 'Investigation').length;
    const actionTaken = complaints.filter(c => c.status === 'Action Taken').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;

    // Check SLA approaching cases
    const now = new Date();
    const approachingSLA = complaints.filter(c => {
      if (c.status === 'Resolved' || !c.slaDeadline) return false;
      const deadline = new Date(c.slaDeadline);
      const diffHours = (deadline - now) / (1000 * 60 * 60);
      return diffHours <= 48; // SLA warning within 48h
    }).length;

    // Recent activity logs
    const recentLogs = (await db.auditLogs.find())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    res.json({
      success: true,
      stats: {
        total,
        newComplaints,
        underReview,
        actionTaken,
        resolved,
        approachingSLA
      },
      recentComplaints: [...complaints]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6),
      recentLogs
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load admin dashboard statistics.' });
  }
});

// List & Filter Complaints for Admin Workspace
router.get('/complaints', async (req, res) => {
  try {
    const { status, category, department, priority, search, page = 1, limit = 20 } = req.query;

    let complaints = await db.complaints.find();

    // Filters
    if (status && status !== 'ALL') {
      complaints = complaints.filter(c => c.status === status);
    }
    if (category && category !== 'ALL') {
      complaints = complaints.filter(c => c.category === category);
    }
    if (department && department !== 'ALL') {
      complaints = complaints.filter(c => c.studentDept === department);
    }
    if (priority && priority !== 'ALL') {
      complaints = complaints.filter(c => c.priority === priority);
    }
    if (search) {
      const q = String(search).toLowerCase();
      complaints = complaints.filter(c =>
        (c.referenceId || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.studentName || '').toLowerCase().includes(q) ||
        (c.studentRollNo || '').toLowerCase().includes(q)
      );
    }

    // Sort by latest created
    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginatedComplaints = complaints.slice(startIndex, startIndex + parseInt(limit, 10));

    res.json({
      success: true,
      total: complaints.length,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      complaints: paginatedComplaints
    });
  } catch (err) {
    console.error('Admin complaints error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints list.' });
  }
});

// Admin Complaint Detailed Workspace
router.get('/complaints/:id', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint record not found.' });
    }

    // Full timeline history
    const history = (await db.statusHistory.find({ complaintId: complaint.id }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // BOTH public updates AND internal confidential notes for admin view
    const updates = (await db.complaintUpdates.find({ complaintId: complaint.id }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const complaintAttachments = await db.attachments.find({ complaintId: complaint.id });

    // Fetch assigned admin info if available
    let assignedAdmin = null;
    if (complaint.assignedAdminId) {
      const admin = await db.users.findById(complaint.assignedAdminId);
      if (admin) {
        assignedAdmin = { id: admin.id, name: admin.name, email: admin.email };
      }
    }

    logAuditAction(req, 'COMPLAINT_VIEWED', 'COMPLAINT', complaint.id, `Admin ${req.user.name} viewed complaint ${complaint.referenceId}`);

    res.json({
      success: true,
      complaint,
      history,
      updates,
      attachments: complaintAttachments,
      assignedAdmin
    });
  } catch (err) {
    console.error('Admin complaint detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to load complaint details.' });
  }
});

// Update Complaint Status & Assign Admin
router.put('/complaints/:id/status', async (req, res) => {
  try {
    const { status, priority, assignedAdminId, comment } = req.body;
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint record not found.' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority value.' });
    }

    const previousStatus = complaint.status;
    const previousAssignee = complaint.assignedAdminId || null;
    const updatesObj = {};

    if (status) updatesObj.status = status;
    if (priority) updatesObj.priority = priority;

    if (assignedAdminId !== undefined) {
      if (assignedAdminId) {
        const adminUser = await db.users.findById(assignedAdminId);
        if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'super_admin') || adminUser.status !== 'active') {
          return res.status(400).json({ success: false, message: 'Selected assignee is not an active administrative user.' });
        }
        updatesObj.assignedAdminId = adminUser.id;
        updatesObj.assignedAdminName = adminUser.name;
      } else {
        updatesObj.assignedAdminId = null;
        updatesObj.assignedAdminName = null;
      }
    }

    const updatedComplaint = await db.complaints.updateOne(complaint.id, updatesObj);

    // Notify the newly assigned officer and record the reassignment in the timeline
    if (updatesObj.assignedAdminId && updatesObj.assignedAdminId !== previousAssignee) {
      await db.notifications.insertOne({
        userId: updatesObj.assignedAdminId,
        title: 'Complaint Assigned to You',
        message: `Complaint ${complaint.referenceId} has been assigned to you by ${req.user.name}.`,
        type: 'assignment',
        referenceId: complaint.referenceId,
        isRead: false
      });

      await db.statusHistory.insertOne({
        complaintId: complaint.id,
        previousStatus: null,
        newStatus: updatedComplaint.status,
        changedById: req.user.id,
        changedByName: req.user.name,
        changedByRole: req.user.role,
        comment: `Case assigned to ${updatesObj.assignedAdminName}`
      });

      logAuditAction(req, 'COMPLAINT_ASSIGNED', 'COMPLAINT', complaint.id, `Complaint ${complaint.referenceId} assigned to ${updatesObj.assignedAdminName}`);
    }

    // Record timeline history if status changed
    if (status && status !== previousStatus) {
      await db.statusHistory.insertOne({
        complaintId: complaint.id,
        previousStatus,
        newStatus: status,
        changedById: req.user.id,
        changedByName: req.user.name,
        changedByRole: req.user.role,
        comment: comment || `Status updated from ${previousStatus} to ${status}`
      });

      // Send student notification
      await db.notifications.insertOne({
        userId: complaint.userId,
        title: `Complaint Status: ${status}`,
        message: `Your complaint ${complaint.referenceId} status has been updated to "${status}".`,
        type: 'status_update',
        referenceId: complaint.referenceId,
        isRead: false
      });
    }

    logAuditAction(
      req,
      'COMPLAINT_STATUS_UPDATED',
      'COMPLAINT',
      complaint.id,
      `Status of ${complaint.referenceId} updated from ${previousStatus} to ${status || previousStatus} by ${req.user.name}`
    );

    res.json({
      success: true,
      message: 'Complaint updated successfully.',
      complaint: updatedComplaint
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update complaint status.' });
  }
});

// Add Official Update or Internal Note
router.post('/complaints/:id/updates', async (req, res) => {
  try {
    const { updateText, isPublic } = req.body;
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint record not found.' });
    }

    if (!updateText || String(updateText).trim() === '') {
      return res.status(400).json({ success: false, message: 'Update text content cannot be empty.' });
    }

    const isPublicBool = isPublic === true || isPublic === 'true';

    const newUpdate = await db.complaintUpdates.insertOne({
      complaintId: complaint.id,
      authorId: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      updateText: String(updateText).trim(),
      isPublic: isPublicBool
    });

    if (isPublicBool) {
      // Notify student of official update
      await db.notifications.insertOne({
        userId: complaint.userId,
        title: 'New Official Update on Complaint',
        message: `An official update has been posted on complaint ${complaint.referenceId}.`,
        type: 'official_update',
        referenceId: complaint.referenceId,
        isRead: false
      });
    }

    logAuditAction(
      req,
      isPublicBool ? 'PUBLIC_UPDATE_ADDED' : 'INTERNAL_NOTE_ADDED',
      'COMPLAINT',
      complaint.id,
      `Added ${isPublicBool ? 'official update' : 'internal note'} to ${complaint.referenceId}`
    );

    res.status(201).json({
      success: true,
      message: isPublicBool ? 'Official public update added.' : 'Internal confidential note saved.',
      update: newUpdate
    });
  } catch (err) {
    console.error('Add update error:', err);
    res.status(500).json({ success: false, message: 'Failed to save update.' });
  }
});

// Manage / Search Student Records
router.get('/students', async (req, res) => {
  try {
    const { search, department } = req.query;
    let students = await db.users.find({ role: 'student' });

    if (department && department !== 'ALL') {
      students = students.filter(s => s.department === department);
    }

    if (search) {
      const q = String(search).toLowerCase();
      students = students.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q)
      );
    }

    // Exclude password hashes and attach complaint counts
    const sanitizedStudents = await Promise.all(students.map(async ({ password, ...rest }) => {
      const studentComplaints = await db.complaints.find({ userId: rest.id });
      return { ...rest, complaintCount: studentComplaints.length };
    }));

    res.json({ success: true, students: sanitizedStudents });
  } catch (err) {
    console.error('Student directory error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch student directory.' });
  }
});

// Toggle student status (active/disabled)
router.put('/students/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const student = await db.users.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    await db.users.updateOne(student.id, { status });

    logAuditAction(req, 'STUDENT_STATUS_TOGGLED', 'USER', student.id, `Student ${student.name} status updated to ${status}`);

    res.json({ success: true, message: `Student status updated to ${status}.` });
  } catch (err) {
    console.error('Student status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update student status.' });
  }
});

module.exports = router;
