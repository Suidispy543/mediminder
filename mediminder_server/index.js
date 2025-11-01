require('dotenv').config();
const express = require('express');
const uploadRouter = require('./routes/upload');

const app = express();
app.use(express.json());

app.use('/upload-prescription', uploadRouter);

const presignRouter = require('./routes/presign');
app.use('/presign', presignRouter);

const notifyRouter = require('./routes/notify');
app.use('/notify-upload', notifyRouter);

// near other router imports
const confirmRouter = require('./routes/confirmPrescription');

// after you have `app` and `express.json()` middleware:
app.use('/confirm-prescription', confirmRouter);




app.get('/health', (req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server listening on port ${port}`));

