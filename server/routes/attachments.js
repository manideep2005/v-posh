const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const DISK_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Serve evidence files ONLY after authentication and an access check.
// Students may fetch attachments of their own complaints; admins and
// super admins may fetch attachments of complaints they can access.
router.get('/:id/file', authenticateToken, async (req, res) => {
  try {
    const attachment = await db.attachments.findById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found.' });
    }

    if (!attachment.complaintId) {
      return res.status(403).json({ success: false, message: 'Attachment is not linked to a complaint yet.' });
    }

    const complaint = await db.complaints.findById(attachment.complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Parent complaint record not found.' });
    }

    const role = req.user.role;
    const isOwner = complaint.userId === req.user.id;
    const isStaff = role === 'admin' || role === 'super_admin';

    // Access policy mirrors complaint-view policy: owners and ICC staff.
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this attachment.' });
    }

    res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalname || attachment.filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // GridFS path (serverless / MongoDB deployments)
    if (attachment.gridFsId && db.getEngineName() === 'mongodb' && db.getMongoDb()) {
      const { GridFSBucket, ObjectId } = require('mongodb');
      const bucket = new GridFSBucket(db.getMongoDb(), { bucketName: 'evidence' });
      const downloadStream = bucket.openDownloadStream(new ObjectId(attachment.gridFsId));
      downloadStream.on('error', () => {
        if (!res.headersSent) res.status(404).json({ success: false, message: 'Stored file is missing.' });
      });
      return downloadStream.pipe(res);
    }

    // Disk path (JSON engine / long-running hosts)
    const filePath = path.join(DISK_UPLOAD_DIR, path.basename(attachment.filename));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Stored file is missing from the server.' });
    }
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Attachment download error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve attachment.' });
  }
});

module.exports = router;
