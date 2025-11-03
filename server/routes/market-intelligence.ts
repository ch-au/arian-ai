/**
 * Market Intelligence API Routes
 * Endpoint für Gemini Flash Marktanalyse
 */

import { Router } from 'express';
import { generateMarketIntelligence, isGeminiConfigured } from '../services/gemini-market-intelligence';
import { createRequestLogger } from '../services/logger';

const router = Router();
const log = createRequestLogger('routes:market-intelligence');

/**
 * POST /api/market-intelligence
 * Generiert Marktanalyse mit Gemini Flash + Google Search
 */
router.post('/', async (req, res) => {
  try {
    // Validiere Gemini API Key
    if (!isGeminiConfigured()) {
      return res.status(503).json({
        error: 'Gemini API nicht konfiguriert',
        message: 'GEMINI_API_KEY Umgebungsvariable fehlt',
      });
    }

    const { title, marktProduktKontext, userRole, produkte } = req.body;

    // Validierung
    if (!title || !marktProduktKontext) {
      return res.status(400).json({
        error: 'Fehlende Parameter',
        message: 'title und marktProduktKontext sind erforderlich',
      });
    }

    // Market Intelligence generieren
    const intelligence = await generateMarketIntelligence({
      title,
      marktProduktKontext,
      userRole: userRole || 'buyer',
      produkte: produkte || [],
    });

    res.json({
      success: true,
      intelligence,
    });
  } catch (error: any) {
    log.error({ err: error }, '[market-intelligence-route] Error occurred');

    res.status(500).json({
      error: 'Market Intelligence Fehler',
      message: error.message || 'Unbekannter Fehler',
    });
  }
});

/**
 * GET /api/market-intelligence/status
 * Prüft ob Gemini konfiguriert ist
 */
router.get('/status', (req, res) => {
  res.json({
    configured: isGeminiConfigured(),
    model: 'gemini-2.0-flash-exp',
    features: ['google_search', 'grounded_search'],
  });
});

export default router;
