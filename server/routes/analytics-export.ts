/**
 * Analytics Export Routes
 * Handles exporting negotiation results in various formats
 * Clean architecture with separated concerns
 */

import { Router, type Request, type Response } from 'express';
import { storage } from '../storage.js';
import { SimulationQueueService } from '../services/simulation-queue.js';
import { createRequestLogger } from '../services/logger.js';

const log = createRequestLogger('routes:analytics-export');

export function createAnalyticsExportRouter(): Router {
  const router = Router();

  /**
   * Export negotiation results
   * GET /api/analytics/export/:negotiationId?format=csv|json|excel
   */
  router.get('/export/:negotiationId', async (req, res) => {
    const { negotiationId } = req.params;
    const format = (req.query.format as string) || 'json';

    try {
      log.info({ negotiationId, format }, 'Exporting negotiation results');

      // Fetch data
      const [negotiation, results, techniques, tactics] = await Promise.all([
        storage.getNegotiation(negotiationId),
        SimulationQueueService.getSimulationResultsByNegotiation(negotiationId),
        storage.getAllInfluencingTechniques(),
        storage.getAllNegotiationTactics()
      ]);

      if (!negotiation) {
        return res.status(404).json({ error: 'Negotiation not found' });
      }

      // Create lookup maps
      const techniqueMap = new Map<string, string>();
      techniques.forEach((tech) => techniqueMap.set(tech.id, tech.name));

      const tacticMap = new Map<string, string>();
      tactics.forEach((tactic) => tacticMap.set(tactic.id, tactic.name));

      // Enrich results with names
      const enrichedResults = (results as Array<Record<string, any>>).map((r) => ({
        ...r,
        techniqueName: techniqueMap.get(r.techniqueId || '') || 'Unknown',
        tacticName: tacticMap.get(r.tacticId || '') || 'Unknown'
      }));

      switch (format) {
        case 'csv':
          return exportAsCSV(res, negotiation, enrichedResults);

        case 'excel':
          // Note: Excel export requires additional library (xlsx)
          // For now, return CSV with Excel mime type
          return exportAsCSV(res, negotiation, enrichedResults, true);

        case 'json':
        default:
          return res.json({
            negotiation: {
              id: negotiation.id,
              title: negotiation.title,
              startedAt: negotiation.startedAt,
              status: negotiation.status
            },
            results: enrichedResults,
            summary: {
              totalRuns: results.length,
              completedRuns: results.filter(r => r.status === 'completed').length,
              successRate: calculateSuccessRate(results),
              totalCost: results.reduce((sum: number, r) =>
                sum + parseFloat(r.actualCost?.toString() || '0'), 0
              )
            }
          });
      }
    } catch (error) {
      log.error({ err: error, negotiationId }, 'Export failed');
      res.status(500).json({
        error: 'Failed to export results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

/**
 * Export results as CSV
 * Pure function - easily testable
 */
function exportAsCSV(
  res: Response,
  negotiation: any,
  results: any[],
  asExcel = false
): void {
  // CSV Headers
  const headers = [
    'Run Number',
    'Technique',
    'Tactic',
    'Personality',
    'ZOPA Distance',
    'Status',
    'Success',
    'Total Rounds',
    'Cost (USD)',
    'Started At',
    'Completed At',
    'Outcome'
  ];

  // CSV Rows
  const rows = (results as Array<Record<string, any>>).map((r) => [
    r.runNumber,
    r.techniqueName,
    r.tacticName,
    r.personalityId || 'N/A',
    r.zopaDistance || 'N/A',
    r.status,
    r.zopaAchieved ? 'Yes' : 'No',
    r.totalRounds || 0,
    parseFloat(r.actualCost?.toString() || '0').toFixed(4),
    r.startedAt || 'N/A',
    r.completedAt || 'N/A',
    r.outcome || 'N/A'
  ]);

  // Build CSV string
  const csvContent = [
    `# Negotiation: ${negotiation.title}`,
    `# Exported: ${new Date().toISOString()}`,
    `# Total Runs: ${results.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  // Set headers
  const filename = `${sanitizeFilename(negotiation.title)}-results.${asExcel ? 'xls' : 'csv'}`;
  const mimeType = asExcel
    ? 'application/vnd.ms-excel'
    : 'text/csv';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}

/**
 * Escape CSV field
 */
function escapeCSV(field: any): string {
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 50);
}

/**
 * Calculate success rate
 */
function calculateSuccessRate(results: any[]): number {
  if (results.length === 0) return 0;
  const completed = results.filter(r => r.status === 'completed');
  if (completed.length === 0) return 0;
  const successful = completed.filter(r => r.zopaAchieved).length;
  return (successful / completed.length) * 100;
}
