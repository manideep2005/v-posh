const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Evidence upload. Two storage backends:
//   - MongoDB GridFS (default when MONGODB_URI is set) — works on serverless
//     hosts where the filesystem is ephemeral (Vercel, Lambda, etc.)
//   - Local disk (server/uploads) — used when running on the JSON engine
// ---------------------------------------------------------------------------

const DISK_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(DISK_UPLOAD_DIR)) {
    fs.mkdirSync(DISK_UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  // Read-only filesystem (Vercel/Lambda): disk storage unavailable, but the
  // module must still load — GridFS is used whenever MongoDB is configured.
  console.warn('Uploads dir not writable, disk evidence storage disabled:', err.message);
}

// Memory storage keeps the flow serverless-safe; the buffer is then written
// either to GridFS or to disk. 10 MB in memory is acceptable.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Allowed formats: PNG, JPEG, WebP, PDF, DOC, DOCX.');
      err.status = 400;
      cb(err);
    }
  }
});

async function storeInGridFS(buffer, originalName, mimetype) {
  const { GridFSBucket } = require('mongodb');
  const mongoDb = db.getMongoDb();
  const bucket = new GridFSBucket(mongoDb, { bucketName: 'evidence' });
  const storedName = `evidence-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(originalName)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(storedName, {
      contentType: mimetype,
      metadata: { originalName }
    });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve({ gridFsId: String(uploadStream.id), filename: storedName }));
    uploadStream.end(buffer);
  });
}

function storeOnDisk(buffer, originalName) {
  const filename = `evidence-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(originalName)}`;
  const filePath = path.join(DISK_UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { gridFsId: null, filename };
}

router.post('/', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files were uploaded.' });
    }

    const savedAttachments = [];
    for (const file of req.files) {
      let stored;
      if (db.getEngineName() === 'mongodb' && db.getMongoDb()) {
        stored = await storeInGridFS(file.buffer, file.originalname, file.mimetype);
      } else {
        stored = storeOnDisk(file.buffer, file.originalname);
      }

      const saved = await db.attachments.insertOne({
        filename: stored.filename,
        gridFsId: stored.gridFsId,
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

// Error handler registered AFTER the route so Express actually routes
// multer rejections (bad type, file too large) here instead of the generic
// 500 handler.
router.use((err, req, res, next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'File exceeds the maximum permitted size of 10 MB.'
    : err.message || 'File upload failed.';
  return res.status(status).json({ success: false, message });
});

module.exports = router;
