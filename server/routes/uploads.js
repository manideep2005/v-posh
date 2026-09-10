const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'evidence-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file type. Allowed formats: PNG, JPEG, WebP, PDF, DOC, DOCX.');
    err.status = 400;
    cb(err);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter
});

// Multer errors (too large, bad type) surface as HTML unless caught here.
router.use((err, req, res, next) => {
  if (err) {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File exceeds the maximum permitted size of 10 MB.'
      : err.message || 'File upload failed.';
    return res.status(status).json({ success: false, message });
  }
  next();
});

router.post('/', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files were uploaded.' });
    }

    const savedAttachments = [];
    for (const file of req.files) {
      const saved = await db.attachments.insertOne({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadedById: req.user.id,
        uploadedByName: req.user.name,
        complaintId: null, // linked when the complaint is submitted
        uploadedAt: new Date().toISOString()
      });
      savedAttachments.push(saved);
    }

    res.json({
      success: true,
      message: `${savedAttachments.length} file(s) uploaded successfully.`,
      attachments: savedAttachments
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'File upload failed.' });
  }
});

module.exports = router;
