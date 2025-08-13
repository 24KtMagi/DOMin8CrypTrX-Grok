// DOMin8™ CrypTrX™ is live

// Access environment variables
const PORT = process.env.PORT || 3000;
const logoUploadDir = process.env.LOGO_UPLOAD_DIR || 'uploads/logos';
const mediaUploadDir = process.env.MEDIA_UPLOAD_DIR || 'uploads/media';
const outputDir = process.env.MEDIA_OUTPUT_DIR || 'outputs'; // Changed to 'outputs' for persistence
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const cleanupFiles = process.env.CLEANUP_FILES !== 'false'; // Set to false in env to disable cleanup

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const mime = require('mime-types'); // New: For MIME types
const execPromise = util.promisify(exec);

const app = express();

// Ensure directories exist
const ensureDir = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
  }
};

Promise.all([
  ensureDir(logoUploadDir),
  ensureDir(mediaUploadDir),
  ensureDir(outputDir),
]).catch((err) => console.error('Directory setup failed:', err));

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'logo' ? logoUploadDir : mediaUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.static('public'));
app.use('/outputs', express.static(outputDir)); // Serve saved outputs publicly

app.post('/process', upload.fields([{ name: 'file' }, { name: 'logo' }]), async (req, res) => {
  const file = req.files?.file?.[0];
  const logo = req.files?.logo?.[0];
  const fileType = req.body.type;

  if (!file || !logo || !fileType) {
    return res.status(400).send('Missing file, logo, or file type');
  }

  const filePath = file.path;
  const logoPath = logo.path;
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ext = fileType === 'image' ? 'png' : fileType === 'video' ? 'mp4' : 'glb'; // Assuming GLB for 3D; adjust as needed
  const outputFilename = `domin8_${uniqueId}.${ext}`;
  const outputPath = path.join(outputDir, outputFilename);

  console.log(`Processing ${fileType}: File=${file.originalname}, Logo=${logo.originalname}, Output=${outputFilename}`);

  try {
    if (fileType === 'image') {
      if (!file.mimetype.startsWith('image/') || !logo.mimetype.startsWith('image/')) {
        throw new Error('Invalid image file type');
      }
      await sharp(filePath)
        .composite([{ input: logoPath, gravity: 'west' }])
        .toFile(outputPath);
    } else if (fileType === 'video') {
      if (!file.mimetype.startsWith('video/') || !logo.mimetype.startsWith('image/')) {
        throw new Error('Invalid video/logo file type');
      }
      await execPromise(
        `${ffmpegPath} -i "${filePath}" -i "${logoPath}" -filter_complex "overlay=10:H/2-h/2" "${outputPath}"`
      );
    } else if (fileType === '3d') {
      // For 3D, copy as placeholder (integrate logo if possible, e.g., via a 3D lib later)
      await fs.copyFile(filePath, outputPath);
    } else {
      throw new Error('Unsupported file type');
    }

    // Send the file for download with proper MIME
    const mimeType = mime.lookup(outputPath) || 'application/octet-stream';
    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.sendFile(outputPath, async (err) => {
      if (err) {
        console.error('Send file error:', err);
        res.status(500).send('File send failed');
      }
      // Optional cleanup (only uploads, keep output for saving)
      if (cleanupFiles) {
        await Promise.all([fs.unlink(filePath), fs.unlink(logoPath)]).catch(console.error);
      } else {
        console.log('Files persisted (cleanup disabled)');
      }
    });
  } catch (err) {
    console.error('Processing error:', err.message);
    res.status(500).send(`Processing error: ${err.message}`);
    // Cleanup on error
    await Promise.all([fs.unlink(filePath).catch(() => {}), fs.unlink(logoPath).catch(() => {}), fs.unlink(outputPath).catch(() => {})]);
  }
});

// Optional: List saved outputs (for debugging/persistence)
app.get('/outputs/list', async (req, res) => {
  try {
    const files = await fs.readdir(outputDir);
    res.json(files.map(file => ({ name: file, url: `/outputs/${file}` })));
  } catch (err) {
    res.status(500).send('Error listing outputs');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💾 App is live on port ${PORT}`);
});
