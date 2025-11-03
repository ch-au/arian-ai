/**
 * Gemini Flash Market Intelligence Service
 * Bridge zu Python Script mit Google Gemini 2-5 Flash + Grounded Search
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequestLogger } from './logger';

const execAsync = promisify(exec);
const log = createRequestLogger('service:gemini-market-intelligence');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MarketIntelligenceContext {
  title: string;
  marktProduktKontext: string;
  userRole: 'buyer' | 'seller';
  produkte: Array<{
    id: string;
    produktName: string;
    zielPreis: number;
  }>;
}

export interface MarketIntelligenceItem {
  aspekt: string;
  quelle: string;
  relevanz: 'hoch' | 'mittel' | 'niedrig';
}

export interface MarketIntelligenceResult {
  intelligence: MarketIntelligenceItem[];
}

/**
 * Generiert Marktanalyse mit Gemini Flash
 */
export async function generateMarketIntelligence(
  context: MarketIntelligenceContext
): Promise<MarketIntelligenceItem[]> {
  // Python Script Path
  const scriptPath = path.join(__dirname, '../../scripts/gemini_market_intelligence.py');

  // Context als JSON
  const contextJson = JSON.stringify(context);

  // Python Command
  const pythonCmd = `python3 "${scriptPath}" '${contextJson.replace(/'/g, "'\\''")}'`;

  log.info({ scriptPath, context }, '[gemini-intelligence] Calling Python script');

  try {
    const { stdout, stderr } = await execAsync(pythonCmd, {
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      },
      timeout: 30000, // 30 Sekunden Timeout
    });

    if (stderr) {
      log.warn({ stderr }, '[gemini-intelligence] Python stderr');
    }

    log.debug({ stdout }, '[gemini-intelligence] Python stdout');

    // Parse JSON Response
    const result: MarketIntelligenceResult = JSON.parse(stdout);

    return result.intelligence || [];
  } catch (error: any) {
    log.error({ err: error }, '[gemini-intelligence] Error occurred');

    // Fallback bei Fehler
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Gemini API Timeout - bitte später erneut versuchen');
    }

    if (error.stderr) {
      log.error({ stderr: error.stderr }, '[gemini-intelligence] Python error output');
    }

    // Generischer Fehler
    throw new Error(`Market Intelligence Fehler: ${error.message}`);
  }
}

/**
 * Validiert ob Gemini API Key gesetzt ist
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
