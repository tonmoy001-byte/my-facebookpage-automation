const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { verifyWebhook } = require('./src/facebook');
const { handleIncomingWebhook } = require('./src/webhook');
const { autoPost, generateDraft, publishDraft } = require('./src/poster');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Multer for processing file uploads natively
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Body parser middleware
app.use(express.json());

// Serve static frontend files and our local uploads
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Webhook Endpoints
// ==========================================
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleIncomingWebhook);

// ==========================================
// Draft Dashboard APIs
// ==========================================

// 1. Generate Draft
app.post('/api/draft', upload.array('imageFiles', 4), async (req, res) => {
  const topic = req.body.topic;
  
  if (!topic) {
    return res.status(400).send({ error: 'Instruction topic is required to generate a draft.' });
  }

  try {
    // Generate AI Caption
    const generatedCaption = await generateDraft(topic);
    
    // Manage successful file upload metadata (multiple files)
    let imageUrls = [];
    let localFilePaths = [];
    
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => '/uploads/' + file.filename);
      localFilePaths = req.files.map(file => file.path);
    }

    res.status(200).send({ 
      caption: generatedCaption, 
      imageUrls: imageUrls, 
      localFilePaths: localFilePaths 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Failed to generate AI caption draft.' });
  }
});

// 2. Publish Approved Draft
app.post('/api/publish', async (req, res) => {
  const { caption, localFilePaths } = req.body;
  
  if (!caption) {
    return res.status(400).send({ error: 'Caption is required to publish.' });
  }

  try {
    // localFilePaths is an array of absolute disk paths (or null/empty)
    const fbRes = await publishDraft(caption, localFilePaths);
    res.status(200).send({ message: 'Post successfully published to Facebook!', id: fbRes.id });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Failed to publish post to Facebook via Graph API.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n=============================================`);
  console.log(`🚀 Facebook Page Automation Server is Running!`);
  console.log(`=============================================`);
  console.log(`  🖥️  Dashboard UI: http://localhost:${PORT}`);
  console.log(`  📡 Webhook URL: http://localhost:${PORT}/webhook (Requires ngrok)`);
  console.log(`  👤 Page ID Configured: ${process.env.PAGE_ID}`);
  console.log(`=============================================\n`);
});
