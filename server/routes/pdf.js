const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { generateAcknowledgement, generateStatusReport, storeDocument, getDocument } = require('../services/pdf');

// ─── Student PDF Routes ──────────────────────────────────────────────────────

// Generate Complaint Acknowledgement PDF
router.get('/student/complaints/:id/acknowledgement', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (complaint.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });

    const { buffer, docId, verifyToken, filename } = await generateAcknowledgement(complaint, req.user);

    storeDocument(docId, {
      docId,
      type: 'acknowledgement',
      complaintId: complaint.id,
      complaintRef: complaint.referenceId,
      generatedBy: req.user.id,
      verifyToken,
    });

    logAuditAction(req, 'PDF_GENERATED', 'COMPLAINT', complaint.id, `Acknowledgement PDF generated: ${docId}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
});

// Generate Case Status Report PDF
router.get('/student/complaints/:id/status-report', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (complaint.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });

    const history = (await db.statusHistory.find({ complaintId: complaint.id }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const allUpdates = await db.complaintUpdates.find({ complaintId: complaint.id });
    const publicUpdates = allUpdates.filter(u => u.isPublic).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const { buffer, docId, verifyToken, filename } = await generateStatusReport(complaint, req.user, history, publicUpdates);

    storeDocument(docId, {
      docId,
      type: 'status-report',
      complaintId: complaint.id,
      complaintRef: complaint.referenceId,
      generatedBy: req.user.id,
      verifyToken,
    });

    logAuditAction(req, 'PDF_GENERATED', 'COMPLAINT', complaint.id, `Status report PDF generated: ${docId}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
});

// ─── Admin PDF Routes ────────────────────────────────────────────────────────

router.get('/admin/complaints/:id/acknowledgement', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    const user = await db.users.findById(complaint.userId);
    const { buffer, docId, verifyToken, filename } = await generateAcknowledgement(complaint, user);

    storeDocument(docId, { docId, type: 'acknowledgement', complaintId: complaint.id, complaintRef: complaint.referenceId, generatedBy: req.user.id, verifyToken });
    logAuditAction(req, 'PDF_GENERATED', 'COMPLAINT', complaint.id, `Admin generated acknowledgement PDF: ${docId}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
});

router.get('/admin/complaints/:id/status-report', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    const user = await db.users.findById(complaint.userId);
    const history = (await db.statusHistory.find({ complaintId: complaint.id })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const allUpdates = await db.complaintUpdates.find({ complaintId: complaint.id });
    const publicUpdates = allUpdates.filter(u => u.isPublic).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const { buffer, docId, verifyToken, filename } = await generateStatusReport(complaint, user, history, publicUpdates);

    storeDocument(docId, { docId, type: 'status-report', complaintId: complaint.id, complaintRef: complaint.referenceId, generatedBy: req.user.id, verifyToken });
    logAuditAction(req, 'PDF_GENERATED', 'COMPLAINT', complaint.id, `Admin generated status report PDF: ${docId}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
});

// ─── Document Verification (Public) ──────────────────────────────────────────

router.get('/verify/:docId', async (req, res) => {
  try {
    const doc = getDocument(req.params.docId);
    if (!doc) {
      return res.json({ verified: false, message: 'Document not found in V-POSH system.' });
    }
    if (doc.status === 'revoked') {
      return res.json({ verified: false, message: 'This document has been revoked.' });
    }
    if (req.query.token !== doc.verifyToken) {
      return res.json({ verified: false, message: 'Invalid verification token.' });
    }

    const typeLabels = { acknowledgement: 'Complaint Acknowledgement', 'status-report': 'Case Status Report' };

    res.json({
      verified: true,
      document: {
        docId: doc.docId,
        type: typeLabels[doc.type] || doc.type,
        complaintRef: doc.complaintRef,
        issued: doc.createdAt,
        status: 'Authentic',
      }
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Verification failed.' });
  }
});

// ─── Public Complaint Verification (scannable QR target) ──────────────────────
router.get('/case/:refId', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.referenceId === req.params.refId);
    if (!complaint) {
      return res.json({ verified: false, message: 'Complaint not found in V-POSH system.' });
    }

    // Public-safe info only — no description, no respondent details, no student identity
    res.json({
      verified: true,
      complaint: {
        referenceId: complaint.referenceId,
        category: complaint.category,
        priority: complaint.priority,
        status: complaint.status,
        submittedOn: complaint.createdAt,
        title: complaint.title,
      },
      platform: {
        name: 'V-POSH',
        fullName: 'VIT-AP POSH Awareness & Complaint Management Platform',
        university: 'VIT-AP University',
        email: 'vposh@vitap.ac.in',
        helpline: '+91 863-2377777 / 1800-112-9900',
      }
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Verification failed.' });
  }
});

module.exports = router;
