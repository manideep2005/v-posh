const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { sendService } = require('../services/email');
const { statutoryMilestones, complianceSummary } = require('../services/statutory');

// Middleware: Faculty access only
router.use(authenticateToken, requireRole(['faculty']));

// ─── Faculty Dashboard ─────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const faculty = req.user;
    const allComplaints = await db.complaints.find();

    // Complaints from faculty's department
    const deptComplaints = allComplaints.filter(
      c => c.studentDept === faculty.department
    );

    // Complaints assigned to this faculty
    const assignedComplaints = allComplaints.filter(
      c => c.assignedAdminId === faculty.id
    );

    const totalDept = deptComplaints.length;
    const activeDept = deptComplaints.filter(c => c.status !== 'Resolved').length;
    const resolvedDept = deptComplaints.filter(c => c.status === 'Resolved').length;
    const totalAssigned = assignedComplaints.length;
    const activeAssigned = assignedComplaints.filter(c => c.status !== 'Resolved').length;

    // Students in faculty's department
    const students = await db.users.find({ role: 'student', department: faculty.department });

    // Recent activity
    const recentComplaints = [...deptComplaints]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    // Notifications
    const notifications = (await db.notifications.find({ userId: faculty.id }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Department statutory health — which cases are about to breach a deadline
    const deptIds = new Set(deptComplaints.map(c => c.id));
    const historyRows = await db.statusHistory.find();
    const historyByComplaint = {};
    historyRows.forEach(h => {
      if (!deptIds.has(h.complaintId)) return;
      historyByComplaint[h.complaintId] = historyByComplaint[h.complaintId] || [];
      historyByComplaint[h.complaintId].push(h);
    });
    const compliance = complianceSummary(deptComplaints, historyByComplaint);

    res.json({
      success: true,
      stats: {
        deptTotal: totalDept,
        deptActive: activeDept,
        deptResolved: resolvedDept,
        assignedTotal: totalAssigned,
        assignedActive: activeAssigned,
        deptStudents: students.length,
        statutoryOverdue: compliance.overdue,
        statutoryDueSoon: compliance.dueSoon,
      },
      compliance,
      recentComplaints,
      notifications,
    });
  } catch (err) {
    console.error('Faculty dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load faculty dashboard.' });
  }
});

// ─── Department Complaints ─────────────────────────────────────────────────

router.get('/complaints', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let complaints = await db.complaints.find({ studentDept: req.user.department });

    if (status && status !== 'ALL') {
      complaints = complaints.filter(c => c.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      complaints = complaints.filter(c =>
        (c.referenceId || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.studentName || '').toLowerCase().includes(q)
      );
    }

    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const start = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginated = complaints.slice(start, start + parseInt(limit, 10));

    res.json({ success: true, total: complaints.length, page: parseInt(page, 10), complaints: paginated });
  } catch (err) {
    console.error('Faculty complaints error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints.' });
  }
});

// ─── Complaint Detail ──────────────────────────────────────────────────────

router.get('/complaints/:id', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(
      c => (c.id === req.params.id || c.referenceId === req.params.id) && c.studentDept === req.user.department
    );
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found in your department.' });
    }

    const history = (await db.statusHistory.find({ complaintId: complaint.id }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const updates = (await db.complaintUpdates.find({ complaintId: complaint.id }))
      .filter(u => u.isPublic)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const attachments = await db.attachments.find({ complaintId: complaint.id });

    // Department faculty see the same statutory clock the ICC works from.
    const statutory = statutoryMilestones(complaint, history);

    res.json({ success: true, complaint, history, updates, attachments, statutory });
  } catch (err) {
    console.error('Faculty complaint detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to load complaint details.' });
  }
});

// ─── Raise Complaint on Behalf of Student ──────────────────────────────────

router.post('/complaints', async (req, res) => {
  try {
    const {
      title, category, description, incidentDate, incidentLocation,
      respondentName, respondentDept, studentEmail, studentName, studentRollNo
    } = req.body;

    if (!title || !category || !description || !incidentDate) {
      return res.status(400).json({ success: false, message: 'Title, Category, Description, and Incident Date are required.' });
    }

    // Verify the student exists and belongs to faculty's department
    let studentUser = null;
    if (studentEmail) {
      studentUser = await db.users.findOne({ email: studentEmail.toLowerCase().trim(), role: 'student' });
    }

    const year = new Date().getFullYear();
    const prefix = `POSH-${year}-`;
    const referenceId = await db.complaints.nextReferenceId(prefix);

    const newComplaint = await db.complaints.insertOne({
      referenceId,
      userId: studentUser ? studentUser.id : null,
      studentName: studentName || (studentUser ? studentUser.name : 'Unknown'),
      studentRollNo: studentRollNo || (studentUser ? studentUser.studentId : 'N/A'),
      studentDept: req.user.department,
      title: String(title).trim(),
      category,
      description,
      incidentDate,
      incidentLocation: incidentLocation || 'Unspecified',
      respondentName: respondentName || 'Not Disclosed',
      respondentDept: respondentDept || 'Unspecified',
      status: 'Submitted',
      priority: 'Medium',
      assignedAdminId: null,
      assignedAdminName: null,
      raisedBy: 'faculty',
      raisedById: req.user.id,
      raisedByName: req.user.name,
      attachmentIds: [],
    });

    // Notify admins
    const admins = await db.users.find({ role: { $in: ['admin', 'super_admin'] }, status: 'active' });
    for (const admin of admins) {
      await db.notifications.insertOne({
        userId: admin.id,
        title: 'New Complaint (Faculty-Reported)',
        message: `${req.user.name} raised a complaint (${referenceId}) on behalf of a student in ${req.user.department}.`,
        type: 'complaint_submitted',
        referenceId,
        isRead: false,
      });
    }

    // Notify student if found
    if (studentUser) {
      await db.notifications.insertOne({
        userId: studentUser.id,
        title: 'Complaint Filed on Your Behalf',
        message: `A complaint (${referenceId}) has been filed for you by ${req.user.name}.`,
        type: 'complaint_submitted',
        referenceId,
        isRead: false,
      });
    }

    await db.statusHistory.insertOne({
      complaintId: newComplaint.id,
      previousStatus: null,
      newStatus: 'Submitted',
      changedById: req.user.id,
      changedByName: req.user.name,
      changedByRole: 'faculty',
      comment: 'Complaint filed by faculty member on behalf of student.',
    });

    const alertData = {
      referenceId,
      title: String(title).trim(),
      category,
      priority: 'Medium',
      raisedByName: req.user.name,
      raisedByRole: 'faculty',
      department: req.user.department || 'N/A',
      submittedAt: newComplaint.createdAt,
    };

    // The student named in the complaint is told, even when filed by a faculty member.
    if (studentUser && studentUser.email) {
      sendService('faculty_filed_on_behalf', {
        to: studentUser.email,
        data: {
          referenceId,
          studentName: studentUser.name,
          facultyName: req.user.name,
          department: req.user.department || 'your department',
          title: String(title).trim(),
          category,
          filedAt: newComplaint.createdAt,
        },
        meta: { complaintId: newComplaint.id },
      }).catch(err => console.error('[Email] Filed-on-behalf email failed:', err.message));
    }

    // Alert the ICC queue, in parallel with the in-app notifications above.
    const iccRecipients = new Set(admins.map(a => a.email).filter(Boolean));
    if (config.ICC_NOTIFICATION_EMAIL) iccRecipients.add(config.ICC_NOTIFICATION_EMAIL);
    for (const recipient of iccRecipients) {
      sendService('new_complaint_alert', {
        to: recipient,
        data: { ...alertData, officerName: 'ICC Committee' },
        meta: { complaintId: newComplaint.id },
      }).catch(err => console.error('[Email] New complaint alert failed:', err.message));
    }

    logAuditAction(req, 'COMPLAINT_SUBMITTED_FACULTY', 'COMPLAINT', newComplaint.id, `Faculty ${req.user.name} raised complaint ${referenceId}`);

    res.status(201).json({ success: true, message: 'Complaint filed successfully.', complaint: newComplaint });
  } catch (err) {
    console.error('Faculty complaint submit error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit complaint.' });
  }
});

// ─── Students in Department ────────────────────────────────────────────────

router.get('/students', async (req, res) => {
  try {
    const { search } = req.query;
    let students = await db.users.find({ role: 'student', department: req.user.department });

    if (search) {
      const q = search.toLowerCase();
      students = students.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q)
      );
    }

    const sanitized = await Promise.all(students.map(async ({ password, ...rest }) => {
      const complaints = await db.complaints.find({ userId: rest.id });
      return { ...rest, complaintCount: complaints.length };
    }));

    res.json({ success: true, students: sanitized });
  } catch (err) {
    console.error('Faculty students error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch students.' });
  }
});

// ─── Faculty Profile ───────────────────────────────────────────────────────

router.get('/profile', async (req, res) => {
  try {
    const { password, resetTokenHash, resetTokenExpiresAt, ...safe } = await db.users.findById(req.user.id);
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { name, phone, designation, department } = req.body;
    const updated = await db.users.updateOne(req.user.id, {
      name: name || req.user.name,
      phone: phone !== undefined ? phone : req.user.phone,
      designation: designation || req.user.designation,
      department: department || req.user.department,
    });
    const { password, ...safe } = updated || {};
    res.json({ success: true, message: 'Profile updated.', user: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

module.exports = router;
