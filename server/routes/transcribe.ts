/**
 * Audio Transcription API Route
 * Verwendet OpenAI Whisper API für Speech-to-Text
 */

import { Router } from 'express';
import multer from 'multer';
import { OpenAI } from 'openai';
import fs from 'fs';
import { createRequestLogger } from '../services/logger';

const router = Router();
const log = createRequestLogger('routes:transcribe');

// Multer für File Upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
});

/**
 * POST /api/transcribe
 * Transkribiert Audio mit Whisper API
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'OpenAI API nicht konfiguriert',
        message: 'OPENAI_API_KEY Umgebungsvariable fehlt',
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'Keine Datei hochgeladen',
        message: 'Bitte laden Sie eine Audio-Datei hoch',
      });
    }

    const language = req.body.language || 'de'; // Default: Deutsch

    log.info({ 
      filename: req.file.originalname, 
      size: req.file.size, 
      mimetype: req.file.mimetype, 
      language 
    }, '[transcribe] Received file');

    // OpenAI Client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Whisper API erwartet eine File, nicht einen Buffer
    // Temporäre Datei erstellen
    const tempFilePath = `/tmp/audio-${Date.now()}.webm`;
    fs.writeFileSync(tempFilePath, req.file.buffer);

    try {
      // Whisper API Call
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: language,
        response_format: 'json',
      });

      log.info({ text: transcription.text }, '[transcribe] Transcription successful');

      // Temporäre Datei löschen
      fs.unlinkSync(tempFilePath);

      res.json({
        success: true,
        text: transcription.text,
      });
    } catch (whisperError: any) {
      // Temporäre Datei löschen
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw whisperError;
    }
  } catch (error: any) {
    log.error({ err: error }, '[transcribe] Error occurred');

    res.status(500).json({
      error: 'Transkription fehlgeschlagen',
      message: error.message || 'Unbekannter Fehler',
    });
  }
});

export default router;
