// server/routes/presign.js
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;
if (!BUCKET) throw new Error('S3_BUCKET not set in .env');

const s3 = new S3Client({ region: REGION });

// GET /presign?filename=orig.jpg&contentType=image/jpeg
router.get('/', async (req, res) => {
  try {
    const filename = req.query.filename || `${Date.now()}.jpg`;
    const contentType = req.query.contentType || 'image/jpeg';
    const key = `prescriptions/${Date.now()}-${uuidv4()}-${filename}`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      // optionally set ACL or ServerSideEncryption here
    });

    // expiry seconds
    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 minutes

    return res.json({ url, key, bucket: BUCKET });
  } catch (err) {
    console.error('presign error', err);
    return res.status(500).json({ message: err.message || 'Presign failed' });
  }
});

module.exports = router;
