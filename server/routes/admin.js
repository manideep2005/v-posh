const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { sendEmail, TEMPLATES } = require('../services/email');
const { getSLAStatus } = require('../services/sla');

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

    const sla = getSLAStatus(complaint);

    res.json({
      success: true,
      complaint,
      history,
      updates,
      attachments: complaintAttachments,
      assignedAdmin,
      sla
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

      // Send student notification (in-app)
      await db.notifications.insertOne({
        userId: complaint.userId,
        title: `Complaint Status: ${status}`,
        message: `Your complaint ${complaint.referenceId} status has been updated to "${status}".`,
        type: 'status_update',
        referenceId: complaint.referenceId,
        isRead: false
      });

      // Send status update email to student
      const studentUser = await db.users.findById(complaint.userId);
      if (studentUser) {
        sendEmail({
          to: studentUser.email,
          ...TEMPLATES.statusUpdated({
            referenceId: complaint.referenceId,
            studentName: studentUser.name,
            previousStatus,
            newStatus: status,
            comment: comment || '',
          })
        }).catch(err => console.error('[Email] Status update email failed:', err.message));
      }
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
      // Notify student of official update (in-app)
      await db.notifications.insertOne({
        userId: complaint.userId,
        title: 'New Official Update on Complaint',
        message: `An official update has been posted on complaint ${complaint.referenceId}.`,
        type: 'official_update',
        referenceId: complaint.referenceId,
        isRead: false
      });

      // Send official update email to student
      const updateStudent = await db.users.findById(complaint.userId);
      if (updateStudent) {
        sendEmail({
          to: updateStudent.email,
          ...TEMPLATES.officialUpdate({
            referenceId: complaint.referenceId,
            studentName: updateStudent.name,
            authorName: req.user.name,
            updateText: String(updateText).trim(),
          })
        }).catch(err => console.error('[Email] Official update email failed:', err.message));
      }
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

// ─── Case Allocation ───────────────────────────────────────────────────────

// List available officers (admin + super_admin) with workload info
router.get('/available-officers', async (req, res) => {
  try {
    const officers = await db.users.find({
      role: { $in: ['admin', 'super_admin'] },
      status: 'active'
    });

    const complaints = await db.complaints.find();

    const officersWithWorkload = officers.map(officer => {
      const activeCases = complaints.filter(
        c => c.assignedAdminId === officer.id && c.status !== 'Resolved'
      ).length;
      const totalCases = complaints.filter(
        c => c.assignedAdminId === officer.id
      ).length;
      return {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        role: officer.role,
        activeCases,
        totalCases,
      };
    });

    // Sort by active cases ascending (least busy first)
    officersWithWorkload.sort((a, b) => a.activeCases - b.activeCases);

    res.json({ success: true, officers: officersWithWorkload });
  } catch (err) {
    console.error('Available officers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch available officers.' });
  }
});

// Allocate a single case to an officer
router.post('/complaints/:id/allocate', async (req, res) => {
  try {
    const { assignedAdminId } = req.body;
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (!assignedAdminId) {
      return res.status(400).json({ success: false, message: 'assignedAdminId is required.' });
    }

    const officer = await db.users.findById(assignedAdminId);
    if (!officer || !['admin', 'super_admin'].includes(officer.role) || officer.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Selected officer is not valid or not active.' });
    }

    const updated = await db.complaints.updateOne(complaint.id, {
      assignedAdminId: officer.id,
      assignedAdminName: officer.name,
      status: complaint.status === 'Submitted' ? 'Acknowledged' : complaint.status,
    });

    // Notify officer
    await db.notifications.insertOne({
      userId: officer.id,
      title: 'Case Assigned to You',
      message: `Complaint ${complaint.referenceId} has been assigned to you by ${req.user.name}.`,
      type: 'assignment',
      referenceId: complaint.referenceId,
      isRead: false
    });

    // Timeline entry
    await db.statusHistory.insertOne({
      complaintId: complaint.id,
      previousStatus: null,
      newStatus: updated.status,
      changedById: req.user.id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      comment: `Case allocated to ${officer.name}`
    });

    // Send email to officer
    sendEmail({
      to: officer.email,
      ...TEMPLATES.caseAssigned({
        referenceId: complaint.referenceId,
        title: complaint.title,
        priority: complaint.priority,
        status: updated.status,
        officerName: officer.name,
        assignedBy: req.user.name,
      })
    }).catch(err => console.error('Email failed:', err.message));

    logAuditAction(req, 'COMPLAINT_ASSIGNED', 'COMPLAINT', complaint.id, `Complaint ${complaint.referenceId} allocated to ${officer.name}`);

    res.json({ success: true, message: `Case allocated to ${officer.name}.`, complaint: updated });
  } catch (err) {
    console.error('Allocate case error:', err);
    res.status(500).json({ success: false, message: 'Failed to allocate case.' });
  }
});

// Bulk allocate multiple cases to one officer
router.post('/complaints/bulk-allocate', async (req, res) => {
  try {
    const { complaintIds, assignedAdminId } = req.body;

    if (!Array.isArray(complaintIds) || complaintIds.length === 0) {
      return res.status(400).json({ success: false, message: 'complaintIds array is required.' });
    }
    if (!assignedAdminId) {
      return res.status(400).json({ success: false, message: 'assignedAdminId is required.' });
    }

    const officer = await db.users.findById(assignedAdminId);
    if (!officer || !['admin', 'super_admin'].includes(officer.role) || officer.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Selected officer is not valid or not active.' });
    }

    let allocated = 0;
    for (const id of complaintIds) {
      const complaint = await db.complaints.findOne(c => c.id === id || c.referenceId === id);
      if (!complaint) continue;

      await db.complaints.updateOne(complaint.id, {
        assignedAdminId: officer.id,
        assignedAdminName: officer.name,
        status: complaint.status === 'Submitted' ? 'Acknowledged' : complaint.status,
      });

      await db.notifications.insertOne({
        userId: officer.id,
        title: 'Case Assigned to You',
        message: `Complaint ${complaint.referenceId} has been assigned to you by ${req.user.name}.`,
        type: 'assignment',
        referenceId: complaint.referenceId,
        isRead: false
      });

      await db.statusHistory.insertOne({
        complaintId: complaint.id,
        previousStatus: null,
        newStatus: complaint.status,
        changedById: req.user.id,
        changedByName: req.user.name,
        changedByRole: req.user.role,
        comment: `Bulk allocation to ${officer.name}`
      });

      allocated++;
    }

    logAuditAction(req, 'BULK_COMPLAINT_ASSIGNED', 'COMPLAINT', null, `${allocated} complaints bulk-allocated to ${officer.name}`);

    res.json({ success: true, message: `${allocated} case(s) allocated to ${officer.name}.` });
  } catch (err) {
    console.error('Bulk allocate error:', err);
    res.status(500).json({ success: false, message: 'Failed to bulk allocate cases.' });
  }
});

// Auto-assign: pick the least busy active officer for a case
router.post('/complaints/:id/auto-allocate', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    if (complaint.assignedAdminId) {
      return res.status(400).json({ success: false, message: 'Case is already assigned. Unassign first or reassign manually.' });
    }

    const officers = await db.users.find({ role: { $in: ['admin', 'super_admin'] }, status: 'active' });
    if (officers.length === 0) {
      return res.status(400).json({ success: false, message: 'No active officers available for allocation.' });
    }

    const allComplaints = await db.complaints.find();
    const workload = officers.map(officer => ({
      officer,
      activeCases: allComplaints.filter(c => c.assignedAdminId === officer.id && c.status !== 'Resolved').length,
    }));

    // Pick officer with fewest active cases
    workload.sort((a, b) => a.activeCases - b.activeCases);
    const chosen = workload[0].officer;

    const updated = await db.complaints.updateOne(complaint.id, {
      assignedAdminId: chosen.id,
      assignedAdminName: chosen.name,
      status: complaint.status === 'Submitted' ? 'Acknowledged' : complaint.status,
    });

    await db.notifications.insertOne({
      userId: chosen.id,
      title: 'Case Auto-Assigned to You',
      message: `Complaint ${complaint.referenceId} has been auto-assigned to you (least workload).`,
      type: 'assignment',
      referenceId: complaint.referenceId,
      isRead: false
    });

    await db.statusHistory.insertOne({
      complaintId: complaint.id,
      previousStatus: null,
      newStatus: updated.status,
      changedById: req.user.id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      comment: `Auto-allocated to ${chosen.name} (${workload[0].activeCases} active cases)`
    });

    logAuditAction(req, 'COMPLAINT_AUTO_ASSIGNED', 'COMPLAINT', complaint.id, `Complaint ${complaint.referenceId} auto-allocated to ${chosen.name}`);

    res.json({ success: true, message: `Case auto-allocated to ${chosen.name} (${workload[0].activeCases} active cases).`, complaint: updated });
  } catch (err) {
    console.error('Auto-allocate error:', err);
    res.status(500).json({ success: false, message: 'Failed to auto-allocate case.' });
  }
});

// Workload overview: all officers with case counts
router.get('/workload', async (req, res) => {
  try {
    const officers = await db.users.find({ role: { $in: ['admin', 'super_admin'] }, status: 'active' });
    const complaints = await db.complaints.find();

    const workload = officers.map(officer => {
      const assigned = complaints.filter(c => c.assignedAdminId === officer.id);
      return {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        role: officer.role,
        active: assigned.filter(c => c.status !== 'Resolved').length,
        resolved: assigned.filter(c => c.status === 'Resolved').length,
        total: assigned.length,
      };
    });

    workload.sort((a, b) => b.active - a.active);
    res.json({ success: true, workload });
  } catch (err) {
    console.error('Workload error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch workload data.' });
  }
});

// ─── Faculty Management ─────────────────────────────────────────────────────

// List all faculty
router.get('/faculty', async (req, res) => {
  try {
    const { search, department } = req.query;
    let faculty = await db.users.find({ role: 'faculty' });

    if (department && department !== 'ALL') {
      faculty = faculty.filter(f => f.department === department);
    }
    if (search) {
      const q = search.toLowerCase();
      faculty = faculty.filter(f =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.email || '').toLowerCase().includes(q)
      );
    }

    const sanitized = await Promise.all(faculty.map(async ({ password, ...rest }) => {
      const deptComplaints = await db.complaints.find({ studentDept: rest.department });
      return { ...rest, departmentComplaintCount: deptComplaints.length };
    }));

    res.json({ success: true, faculty: sanitized });
  } catch (err) {
    console.error('Faculty list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch faculty list.' });
  }
});

// Create faculty account
router.post('/faculty', async (req, res) => {
  try {
    const { name, email, password, employeeId, department, designation } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({ success: false, message: 'Name, Email, Password, and Department are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const bcrypt = require('bcryptjs');
    const config = require('../config');
    const hashedPassword = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

    const newFaculty = await db.users.insertOne({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'faculty',
      employeeId: employeeId || '',
      department,
      designation: designation || 'Faculty Advisor',
      status: 'active',
      lastActiveAt: null,
    });

    logAuditAction(req, 'FACULTY_ACCOUNT_CREATED', 'USER', newFaculty.id, `Created faculty account: ${name} (${department})`);

    const { password: _, ...safe } = newFaculty;
    res.status(201).json({ success: true, message: `Faculty account for ${name} created.`, faculty: safe });
  } catch (err) {
    console.error('Create faculty error:', err);
    res.status(500).json({ success: false, message: 'Failed to create faculty account.' });
  }
});

// Toggle faculty status
router.put('/faculty/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const faculty = await db.users.findById(req.params.id);
    if (!faculty || faculty.role !== 'faculty') {
      return res.status(404).json({ success: false, message: 'Faculty account not found.' });
    }
    await db.users.updateOne(faculty.id, { status });
    logAuditAction(req, 'FACULTY_STATUS_TOGGLED', 'USER', faculty.id, `Faculty ${faculty.name} status → ${status}`);
    res.json({ success: true, message: `Faculty status updated to ${status}.` });
  } catch (err) {
    console.error('Faculty status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update faculty status.' });
  }
});

// ─── System Announcements ──────────────────────────────────────────────────

router.get('/announcements', async (req, res) => {
  try {
    const announcements = (await db.announcements?.find() || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, announcements });
  } catch (err) {
    res.json({ success: true, announcements: [] });
  }
});

module.exports = router;
