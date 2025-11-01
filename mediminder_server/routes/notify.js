// server/routes/notify.js
const express = require('express');
const fetch = require('node-fetch');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { ComprehendMedicalClient, DetectEntitiesV2Command } = require('@aws-sdk/client-comprehendmedical');

const router = express.Router();
const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;
const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: REGION });
const comprehend = new ComprehendMedicalClient({ region: REGION });

// POST /notify-upload { key: "<s3-key>", optional: patientId, patientName }
router.post('/', async (req, res) => {
  try {
    const { key, patientId, patientName } = req.body;
    if (!key) return res.status(400).json({ message: 'Missing s3 key' });

    // Option A: Synchronous Textract calling DetectDocumentText using S3Object
    const detectCmd = new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: BUCKET, Name: key } }
    });
    const texResp = await textract.send(detectCmd);

    // extract lines
    const lines = (texResp.Blocks || []).filter(b => b.BlockType === 'LINE' && b.Text).map(b => b.Text.trim());
    const fullText = lines.join('\n');

    // optional: run Comprehend Medical
    let medications = [];
    try {
      if (fullText && fullText.length > 0) {
        const cmResp = await comprehend.send(new DetectEntitiesV2Command({ Text: fullText }));
        if (cmResp && cmResp.Entities) {
          medications = cmResp.Entities.filter(e => e.Category === 'MEDICATION').map(e => ({
            name: e.Text,
            confidence: e.Score,
            attributes: e.Attributes || []
          }));
        }
      }
    } catch (cmErr) {
      console.warn('ComprehendMedical failed', cmErr.message || cmErr);
    }

    const parsed = {
      s3ObjectKey: key,
      patientId: patientId || null,
      patientName: patientName || null,
      medications,
      rawText: fullText,
      textractBlocks: texResp.Blocks || []
    };

    // Optionally forward to DASHBOARD_API
    if (process.env.DASHBOARD_API) {
      try {
        await fetch(process.env.DASHBOARD_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.DASHBOARD_API_KEY || '' },
          body: JSON.stringify(parsed)
        });
      } catch (e) {
        console.warn('forward to dashboard failed', e.message || e);
      }
    }

    return res.json(parsed);
  } catch (err) {
    console.error('notify-upload error', err);
    return res.status(500).json({ message: err.message || 'Processing failed' });
  }
});

module.exports = router;
