const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

router.use(authenticateToken);

const SCALE_QUESTIONS = ['feltHeard', 'processFair', 'timeliness', 'clearCommunication'];

function cleanRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

function average(list) {
  if (!list.length) return null;
  return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
}

// ─── Student: submit anonymous feedback once the case is closed ──────────────
router.post('/complaints/:id', requireRole(['student']), async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(
      c => c.id === req.params.id || c.referenceId === req.params.id
    );
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (complaint.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });
    if (complaint.status !== 'Resolved') {
      return res.status(400).json({ success: false, message: 'Feedback opens once the case is resolved.' });
    }

    const existing = await db.caseFeedback.findOne({ complaintId: complaint.id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Feedback has already been recorded for this case.' });
    }

    const ratings = {};
    for (const key of SCALE_QUESTIONS) {
      const value = cleanRating(req.body[key]);
      if (value === null) {
        return res.status(400).json({ success: false, message: `Please rate "${key}" from 1 to 5.` });
      }
      ratings[key] = value;
    }

    // Deliberately stores no user id — the ICC sees aggregates, never who said what.
    await db.caseFeedback.insertOne({
      complaintId: complaint.id,
      referenceId: complaint.referenceId,
      ...ratings,
      comment: (req.body.comment || '').toString().slice(0, 1000),
      createdAt: new Date().toISOString(),
    });

    logAuditAction(req, 'CASE_FEEDBACK_SUBMITTED', 'COMPLAINT', complaint.id,
      `Anonymous post-resolution feedback recorded for ${complaint.referenceId}`);

    res.json({ success: true, message: 'Thank you — your feedback was recorded anonymously.' });
  } catch (err) {
    console.error('Feedback submit error:', err);
    res.status(500).json({ success: false, message: 'Failed to record feedback.' });
  }
});

// ─── Student: has this case already been rated? ──────────────────────────────
router.get('/complaints/:id', requireRole(['student']), async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(
      c => c.id === req.params.id || c.referenceId === req.params.id
    );
    if (!complaint || complaint.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    const feedback = await db.caseFeedback.findOne({ complaintId: complaint.id });
    res.json({ success: true, submitted: !!feedback, eligible: complaint.status === 'Resolved' });
  } catch (err) {
    console.error('Feedback lookup error:', err);
    res.status(500).json({ success: false, message: 'Failed to load feedback state.' });
  }
});

// ─── ICC / Super Admin: aggregate only ──────────────────────────────────────
router.get('/summary', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const [feedback, complaints] = await Promise.all([
      db.caseFeedback.find(),
      db.complaints.find(),
    ]);

    const averages = {};
    for (const key of SCALE_QUESTIONS) {
      averages[key] = average(feedback.map(f => f[key]).filter(v => typeof v === 'number'));
    }
    const overall = average(feedback.flatMap(f => SCALE_QUESTIONS.map(k => f[k]).filter(v => typeof v === 'number')));

    const closed = complaints.filter(c => c.status === 'Resolved');
    const distribution = {};
    for (const key of SCALE_QUESTIONS) {
      distribution[key] = [1, 2, 3, 4, 5].map(rating => feedback.filter(f => f[key] === rating).length);
    }

    res.json({
      success: true,
      totalResponses: feedback.length,
      resolvedCases: closed.length,
      responseRate: closed.length ? Math.round((feedback.length / closed.length) * 100) : 0,
      averages,
      overall,
      distribution,
      recentComments: feedback
        .filter(f => f.comment)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 12)
        .map(f => ({ comment: f.comment, createdAt: f.createdAt, overall: average(SCALE_QUESTIONS.map(k => f[k])) })),
    });
  } catch (err) {
    console.error('Feedback summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to load feedback summary.' });
  }
});

module.exports = router;
