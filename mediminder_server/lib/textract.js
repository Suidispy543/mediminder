// server/lib/textract.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { ComprehendMedicalClient, DetectEntitiesV2Command } = require('@aws-sdk/client-comprehendmedical');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const sharp = require('sharp');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = process.env.S3_BUCKET;
if (!S3_BUCKET) throw new Error('S3_BUCKET not set in .env');

const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: REGION });
const comprehend = new ComprehendMedicalClient({ region: REGION });

async function uploadBufferToS3(buffer, filename, contentType='image/jpeg') {
  const key = `prescriptions/${Date.now()}-${uuidv4()}-${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));
  return key;
}

/* --- Parsing helpers --- */

function extractTextLines(blocks = []) {
  return (blocks || [])
    .filter(b => b.BlockType === 'LINE' && b.Text)
    .map(b => b.Text.trim());
}

/**
 * Heuristic regex-based medication + dose parsing.
 * Looks for lines with patterns like:
 *   - "Paracetamol 500 mg"
 *   - "Aspirin 75mg OD"
 *   - "Metformin 500 mg twice daily"
 * Returns array of { name, dose, confidence, sourceLine }
 */
function parseMedicationsFromLines(lines = []) {
  const meds = [];
  // Primary regex: capture a name part and a dose/strength
  const medLineRegex = /([A-Za-z0-9\-\.\s\/\(\)]+?)\s*,?\s*(\d+(?:\.\d+)?\s*(?:mg|g|mcg|μg|ml|mL|mls|IU|units|tablet|tabs|tab|capsule|cap)?(?:\s*(?:\/\s*\d+)?)?)(.*)/i;
  // Simpler fallback: "Name <space> dose"
  const simpler = /([A-Za-z][A-Za-z0-9\-\s\/\(\)]+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|IU|tablet|tabs|tab|capsule|cap)?)/i;

  for (const line of lines) {
    if (!line || line.trim().length < 2) continue;
    // skip obvious non-medication lines (Rx, Dr., Phone, Address, Sig)
    if (/^(dr\.|dr |doctor|rx:|rx\s|signature|sig:|date:|dob:|age:|address|phone|tel:)/i.test(line)) continue;

    let m = line.match(medLineRegex);
    if (m) {
      const rawName = m[1].trim();
      const dose = (m[2] || '').trim();
      meds.push({ name: rawName, dose, confidence: 0.65, sourceLine: line });
      continue;
    }
    m = line.match(simpler);
    if (m) {
      meds.push({ name: m[1].trim(), dose: (m[2] || '').trim(), confidence: 0.5, sourceLine: line });
      continue;
    }

    // lines containing common medicine keywords - weaker confidence
    if (/(tablet|tab|capsule|mg|mcg|once daily|twice daily|bd|od|tds|night|morning|bd|qd|prn|syrup|drops)/i.test(line)) {
      meds.push({ name: line.trim(), dose: '', confidence: 0.33, sourceLine: line });
    }
  }

  // dedupe by normalized name
  const dedup = [];
  const seen = new Set();
  for (const m of meds) {
    const key = (m.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(m);
    }
  }
  return dedup;
}

/**
 * Try to find patient name with a few heuristics:
 *  - look for lines starting with "Patient" or "Name" or "Pt"
 *  - if not found, find first line that looks like a human name (2-4 words, letters)
 */
function findPatientName(lines = []) {
  for (const l of lines) {
    const m = l.match(/(?:Patient|Patient Name|Name|Pt)\s*[:\-]\s*(.+)/i);
    if (m && m[1]) return m[1].trim();
  }
  // fallback: first candidate line with 2-4 words, mostly letters, no digits
  for (const l of lines) {
    if (!l) continue;
    const words = l.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-z\.\- ]+$/.test(l) && l.length < 60) {
      if (!/\d/.test(l)) return l.trim();
    }
  }
  return null;
}

/* --- Core processing function --- */

async function processPrescriptionBuffer(buffer, originalname='upload.jpg', metadata={}) {
  // Optional: preprocess image with sharp (deskew/resize/convert to jpeg)
  let processedBuffer = buffer;
  try {
    processedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn('sharp preprocessing failed, using original buffer:', err.message || err);
    processedBuffer = buffer;
  }

  // 1) upload to S3
  const key = await uploadBufferToS3(processedBuffer, originalname, 'image/jpeg');

  // 2) synchronous Textract call (DetectDocumentText)
  const detectCmd = new DetectDocumentTextCommand({
    Document: { S3Object: { Bucket: S3_BUCKET, Name: key } }
  });
  const texResp = await textract.send(detectCmd);

  // 3) extract lines and full text
  const lines = extractTextLines(texResp.Blocks || []);
  const fullText = lines.join('\n');

  // 4) Try Comprehend Medical first (if available) to extract medication entities
  let meds = [];
  try {
    if (fullText && fullText.length > 0) {
      const cmResp = await comprehend.send(new DetectEntitiesV2Command({ Text: fullText }));
      if (cmResp && cmResp.Entities && cmResp.Entities.length > 0) {
        meds = cmResp.Entities
          .filter(e => e.Category === 'MEDICATION')
          .map(e => ({
            name: e.Text,
            dose: (e.Attributes || []).find(a => /DOSAGE|STRENGTH/i.test(a.Type))?.Text || "",
            confidence: typeof e.Score === 'number' ? e.Score : 0.7,
            attributes: e.Attributes || [],
            sourceLine: e.Text
          }));
      }
    }
  } catch (err) {
    // Comprehend Medical may not be available in region or may lack permission; fallback to heuristics
    console.warn('Comprehend Medical failed or unavailable:', err.message || err);
    meds = [];
  }

  // 5) If Comprehend didn't return meds, use heuristics
  if (!meds || meds.length === 0) {
    meds = parseMedicationsFromLines(lines);
  }

  // 6) patient name heuristics
  const patientName = findPatientName(lines) || metadata.patientName || null;

  // 7) build parsed payload (only the required fields)
  const parsed = {
    patientName,
    patientId: metadata.patientId || null,
    medications: meds,
    rawText: fullText,
    s3ObjectKey: key,
    textractBlocks: texResp.Blocks || []
  };

  // 8) optionally post to Dashboard API (unchanged)
  if (process.env.DASHBOARD_API) {
    try {
      await fetch(process.env.DASHBOARD_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.DASHBOARD_API_KEY || ''
        },
        body: JSON.stringify(parsed)
      });
    } catch (err) {
      console.warn('Dashboard post failed:', err.message || err);
    }
  }

  return parsed;
}

module.exports = { processPrescriptionBuffer };
