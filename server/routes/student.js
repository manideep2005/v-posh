const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { sendEmail, TEMPLATES } = require('../services/email');

// Middleware to ensure user is student
router.use(authenticateToken, requireRole(['student']));

// Student Dashboard Summary
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.user.id;
    const complaints = await db.complaints.find({ userId: studentId });

    const total = complaints.length;
    const active = complaints.filter(c => c.status !== 'Resolved').length;
    const underReview = complaints.filter(c => c.status === 'Under Review' || c.status === 'Investigation').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;

    // Recent activity (latest status changes and public updates)
    const complaintIds = complaints.map(c => c.id);
    const history = complaintIds.length
      ? (await db.statusHistory.find())
          .filter(h => complaintIds.includes(h.complaintId))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
      : [];

    const publicUpdates = complaintIds.length
      ? (await db.complaintUpdates.find())
          .filter(u => complaintIds.includes(u.complaintId) && u.isPublic)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
      : [];

    res.json({
      success: true,
      stats: { total, active, underReview, resolved },
      recentComplaints: [...complaints]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
      recentUpdates: publicUpdates,
      recentHistory: history
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch student dashboard.' });
  }
});

// Submit a new Complaint
router.post('/complaints', async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      incidentDate,
      incidentLocation,
      respondentName,
      respondentDept,
      attachmentIds
    } = req.body;

    if (!title || !category || !description || !incidentDate) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory fields missing: Title, Category, Description, and Incident Date are required.'
      });
    }

    // Generate a collision-free reference ID: POSH-<year>-<6-digit sequence>
    const year = new Date().getFullYear();
    const prefix = `POSH-${year}-`;
    const referenceId = await db.complaints.nextReferenceId(prefix);

    // Validate referenced attachments: must exist, belong to this student, and not already be linked
    const requestedAttachmentIds = Array.isArray(attachmentIds) ? attachmentIds : [];
    const validAttachmentIds = [];
    for (const attId of requestedAttachmentIds) {
      const att = await db.attachments.findById(attId);
      if (att && att.uploadedById === req.user.id && !att.complaintId) {
        validAttachmentIds.push(att.id);
      }
    }

    const newComplaint = await db.complaints.insertOne({
      referenceId,
      userId: req.user.id,
      studentName: req.user.name,
      studentRollNo: req.user.studentId || 'N/A',
      studentDept: req.user.department || 'N/A',
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
      attachmentIds: validAttachmentIds
    });

    // Link validated attachments to this complaint (enables download access checks)
    for (const attId of validAttachmentIds) {
      await db.attachments.updateOne(attId, { complaintId: newComplaint.id });
    }

    // Record initial status history
    await db.statusHistory.insertOne({
      complaintId: newComplaint.id,
      previousStatus: null,
      newStatus: 'Submitted',
      changedById: req.user.id,
      changedByName: req.user.name,
      changedByRole: 'student',
      comment: 'Complaint officially registered by student.'
    });

    // Send confirmation notification to student (in-app)
    await db.notifications.insertOne({
      userId: req.user.id,
      title: 'Complaint Registered',
      message: `Your complaint (${referenceId}) has been successfully submitted and routed to the ICC committee.`,
      type: 'complaint_submitted',
      referenceId: newComplaint.referenceId,
      isRead: false
    });

    // Send confirmation email to student
    sendEmail({
      to: req.user.email,
      ...TEMPLATES.complaintSubmitted({
        referenceId,
        studentName: req.user.name,
        title: String(title).trim(),
        category,
      })
    }).catch(err => console.error('[Email] Complaint submission email failed:', err.message));

    logAuditAction(req, 'COMPLAINT_SUBMITTED', 'COMPLAINT', newComplaint.id, `Student raised complaint ${referenceId}`);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      complaint: newComplaint
    });
  } catch (err) {
    console.error('Submit complaint error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit complaint.' });
  }
});

// List student complaints
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await db.complaints.find({ userId: req.user.id });
    complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, complaints });
  } catch (err) {
    console.error('List complaints error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints.' });
  }
});

// Get detailed complaint by ID
router.get('/complaints/:id', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // STRICT IDOR PRIVACY CHECK: Must be student's own complaint
    if (complaint.userId !== req.user.id) {
      logAuditAction(req, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'COMPLAINT', complaint.id, 'Student attempted unauthorized view of another student complaint');
      return res.status(403).json({ success: false, message: 'Forbidden. You are not authorized to view this complaint.' });
    }

    // Timeline history
    const history = (await db.statusHistory.find({ complaintId: complaint.id }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // ONLY Public updates (Exclude internal confidential notes)
    const allUpdates = await db.complaintUpdates.find({ complaintId: complaint.id });
    const publicUpdates = allUpdates
      .filter(u => u.isPublic)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Attachments
    const complaintAttachments = await db.attachments.find({ complaintId: complaint.id });

    res.json({
      success: true,
      complaint,
      history,
      updates: publicUpdates,
      attachments: complaintAttachments
    });
  } catch (err) {
    console.error('Complaint detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch complaint details.' });
  }
});

// Update Profile
router.put('/profile', async (req, res) => {
  try {
    const { name, phone, department, year } = req.body;
    const updatedUser = await db.users.updateOne(req.user.id, {
      name: name || req.user.name,
      phone: phone !== undefined ? phone : req.user.phone,
      department: department || req.user.department,
      year: year || req.user.year
    });
    const { password, ...userWithoutPassword } = updatedUser || {};
    res.json({ success: true, message: 'Profile updated successfully.', user: userWithoutPassword });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

module.exports = router;
