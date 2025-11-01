const express = require('express');
const multer = require('multer');
const { processPrescriptionBuffer } = require('../lib/textract');

const router = express.Router();

// use memory storage to access file buffer directly
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB (Textract sync limit)
});

router.post('/', upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded (multipart field name must be "prescription")' });

    // metadata (optional)
    const metadata = {
      patientId: req.body.patientId || null,
      patientName: req.body.patientName || null
    };

    const parsed = await processPrescriptionBuffer(req.file.buffer, req.file.originalname, metadata);

    return res.json(parsed);
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

module.exports = router;

