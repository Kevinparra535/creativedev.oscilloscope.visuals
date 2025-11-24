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
    const userContext = req.body.prompt || "General audio analysis";

    // Construct a structured prompt for the "AI Brain"
    const systemPrompt = `
    You are the "Brain" of an advanced artistic oscilloscope. 
    Your goal is to define the visual personality for a music track based on the user's description.
    
    User Description: "${userContext}"

    Return ONLY a valid JSON object (no markdown, no explanations) with this structure:
    {
      "mood": "string", // e.g., "aggressive", "calm", "psychedelic", "digital", "organic"
      "complexity_preference": 0.0-1.0, // 0.0 = simple lines, 1.0 = chaotic/dense
      "pace": "string", // "slow", "medium", "fast", "frenetic"
      "color_bias": "string", // "green_default", "red_shift", "blue_cool", "neon_mix"
      "preferred_modes": ["string"], // Choose from: "cube", "text", "planet", "chaos", "brain", "eye", "default"
      "suggested_words": ["string"], // List of 3-5 short, punchy words related to the mood (e.g. "PULSE", "VOID")
      "suggested_attractors": ["string"], // Choose from: "lorenz", "rossler", "aizawa"
      "description": "string" // A short artistic summary of why you chose this profile
    }
    `;

    const analysisResponse = await ollamaService.analyzeContext({
      filename: req.file.filename,
      prompt: systemPrompt
    });

    // Try to parse the JSON response
    let analysisData;
    try {
      // Clean up potential markdown code blocks if Ollama adds them
      const jsonString = analysisResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      analysisData = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse AI JSON:", e);
      // Fallback if JSON fails
      analysisData = {
        mood: "neutral",
        complexity_preference: 0.5,
        pace: "medium",
        color_bias: "green_default",
        preferred_modes: ["cube", "brain"],
        description: analysisResponse // Return raw text as description
      };
    }

    res.json({
      success: true,
      file: req.file.filename,
      analysis: analysisData
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio analysis' });
  }
});

module.exports = router;
