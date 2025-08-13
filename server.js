const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage for in-memory processing

app.post('/process', upload.fields([{ name: 'file' }, { name: 'logo' }]), async (req, res) => {
  try {
    const assetBuffer = req.files.file[0].buffer;
    const logoBuffer = req.files.logo[0].buffer;

    // Add logo to asset using sharp
    const asset = await sharp(assetBuffer)
      .composite([{ input: logoBuffer, gravity: 'southeast' }]) // Overlay logo in bottom-right corner (adjust gravity as needed)
      .toBuffer();

    // Encrypt the processed asset (simple AES demo - use a secure key in production)
    const key = crypto.randomBytes(32); // Generate a random key (store securely in real app)
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([iv, cipher.update(asset), cipher.final()]);

    res.send(encrypted);
  } catch (error) {
    console.error(error);
    res.status(500).send('Processing failed');
  }
});

app.post('/save-logo', upload.single('logo'), async (req, res) => {
  try {
    const logoBuffer = req.files.logo[0].buffer;

    // Make logo transparent (assume removing white background for demo; use a better library like remove.bg for production)
    const transparentLogo = await sharp(logoBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } }) // Flatten white to transparent
      .toBuffer();

    res.send(transparentLogo);
  } catch (error) {
    console.error(error);
    res.status(500).send('Logo processing failed');
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
