// server/routes/confirmPrescription.js
const express = require('express');
const fetch = require('node-fetch'); // already used in your project

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};

    // basic validation
    if (!payload || !Array.isArray(payload.medications)) {
      return res.status(400).json({ message: 'Invalid payload: medications array required' });
    }

    // If you have a real dashboard API, forward to it:
    if (process.env.DASHBOARD_API) {
      try {
        const forwardResp = await fetch(process.env.DASHBOARD_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.DASHBOARD_API_KEY || ''
          },
          body: JSON.stringify(payload)
        });
        const forwardJson = await forwardResp.json().catch(()=>null);
        if (!forwardResp.ok) {
          return res.status(502).json({ message: 'Forward to dashboard failed', details: forwardJson });
        }
        return res.json({ message: 'Saved to dashboard', dashboardResponse: forwardJson });
      } catch (err) {
        console.warn('Forward to dashboard error:', err?.message || err);
        return res.status(502).json({ message: 'Forward to dashboard failed', error: err?.message || String(err) });
      }
    }

    // No dashboard configured: just echo back for dev
    return res.json({ message: 'Received in dev (no DASHBOARD_API)', payload });
  } catch (err) {
    console.error('confirm-prescription error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;
