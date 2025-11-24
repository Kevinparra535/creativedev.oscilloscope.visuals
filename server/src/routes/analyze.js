const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ollamaService = require('../services/ollama');

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// POST /api/analyze/audio
router.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log(`Received file: ${req.file.filename}`);

    // TODO: Integrate Speech-to-Text (STT) here if needed.
    // Llama 3.1 is a text model. To "analyze audio", we typically need to:
    // 1. Transcribe audio to text (using Whisper, etc.)
    // 2. Send text to Ollama for analysis.
    
    // Use provided prompt or default
    const userPrompt = req.body.prompt || "Analyze the potential emotional characteristics of this audio file.";

    const analysis = await ollamaService.analyzeContext({
      filename: req.file.filename,
      prompt: userPrompt
    });

    res.json({
      success: true,
      file: req.file.filename,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio analysis' });
  }
});

module.exports = router;
