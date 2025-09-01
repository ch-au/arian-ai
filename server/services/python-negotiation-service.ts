/**
 * Python Negotiation Microservice Bridge
 * Executes negotiations using the Python OpenAI Agents implementation
 */

import { spawn } from 'child_process';
import { db } from '../storage';
import { simulationRuns, negotiations, negotiationDimensions, influencingTechniques, negotiationTactics, negotiationContexts } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface PythonNegotiationRequest {
  negotiationId: string;
  simulationRunId: string;
  techniqueId?: string;
  tacticId?: string;
  maxRounds?: number;
  queueId?: string;
}

export interface RoundUpdateCallback {
  (roundData: {
    round: number;
    agent: string;
    message: string;
    offer?: any;
    queueId?: string;
    simulationId: string;
    negotiationId: string;
  }): void;
}

export interface PythonNegotiationResult {
  outcome: 'DEAL_ACCEPTED' | 'TERMINATED' | 'WALK_AWAY' | 'PAUSED' | 'MAX_ROUNDS_REACHED' | 'ERROR';
  totalRounds: number;
  finalOffer?: any;
  conversationLog: Array<{
    round: number;
    agent: string;
    response: any;
  }>;
  langfuseTraceId?: string;
}

export class PythonNegotiationService {

  /**
   * Run a single negotiation using the Python microservice
   */
  static async runNegotiation(
    request: PythonNegotiationRequest, 
    onRoundUpdate?: RoundUpdateCallback
  ): Promise<PythonNegotiationResult> {
    try {
      // Fetch comprehensive negotiation data
      const negotiationData = await this.fetchNegotiationData(request.negotiationId);
      
      // Fetch technique and tactic details
      let technique = null;
      let tactic = null;
      
      if (request.techniqueId) {
        technique = await this.fetchTechniqueData(request.techniqueId);
      }
      
      if (request.tacticId) {
        tactic = await this.fetchTacticData(request.tacticId);
      }
      
      // Create comprehensive data package
      const fullNegotiationData = {
        ...negotiationData,
        technique,
        tactic
      };
      
      // Prepare arguments for Python script
      const scriptArgs = [
        'scripts/run_production_negotiation.py',
        '--negotiation-id', request.negotiationId,
        '--simulation-run-id', request.simulationRunId,
        '--max-rounds', (request.maxRounds || 6).toString(),
        '--negotiation-data', JSON.stringify(fullNegotiationData)
      ];

      if (request.techniqueId) {
        scriptArgs.push('--technique-id', request.techniqueId);
      }
      
      if (request.tacticId) {
        scriptArgs.push('--tactic-id', request.tacticId);
      }

      // Execute Python script
      const result = await this.executePythonScript(scriptArgs, onRoundUpdate, request);
      
      // Update simulation run with results
      await this.updateSimulationRun(request.simulationRunId, result);
      
      return result;
      
    } catch (error) {
      console.error('Python negotiation service error:', error);
      throw error;
    }
  }

  /**
   * Execute the Python negotiation script
   */
  private static executePythonScript(
    args: string[], 
    onRoundUpdate?: RoundUpdateCallback,
    request?: PythonNegotiationRequest
  ): Promise<PythonNegotiationResult> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONPATH: process.cwd()
        }
      });

      let stdout = '';
      let stderr = '';
      let buffer = '';

      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Parse real-time updates from Python output immediately
        if (onRoundUpdate && request) {
          this.parseRoundUpdates(chunk, onRoundUpdate, request);
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON result from stdout, filtering out ROUND_UPDATE lines
          const lines = stdout.split('\n');
          let jsonOutput = '';
          
          // Find the final JSON output (lines that don't start with ROUND_UPDATE)
          for (const line of lines) {
            if (line.trim() && !line.startsWith('ROUND_UPDATE:')) {
              jsonOutput += line + '\n';
            }
          }
          
          if (!jsonOutput.trim()) {
            reject(new Error('No JSON output found from Python script'));
            return;
          }
          
          const result = JSON.parse(jsonOutput.trim());
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse Python output:', stdout);
          reject(new Error(`Failed to parse Python script output: ${parseError}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Parse real-time round updates from Python script output
   */
  private static parseRoundUpdates(
    buffer: string, 
    onRoundUpdate: RoundUpdateCallback, 
    request: PythonNegotiationRequest
  ) {
    // Look for real-time update markers in the output
    // Expected format: ROUND_UPDATE:{"round":1,"agent":"BUYER","message":"...","offer":{...}}
    const lines = buffer.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('ROUND_UPDATE:')) {
        try {
          const jsonData = line.substring('ROUND_UPDATE:'.length);
          const roundData = JSON.parse(jsonData);
          
          console.log(`Emitting round update for round ${roundData.round}:`, roundData.agent);
          
          // Call the callback with the round update
          onRoundUpdate({
            round: roundData.round,
            agent: roundData.agent,
            message: roundData.message,
            offer: roundData.offer,
            queueId: request.queueId,
            simulationId: request.simulationRunId,
            negotiationId: request.negotiationId
          });
        } catch (error) {
          console.warn('Failed to parse round update:', line, error);
        }
      }
    }
  }

  /**
   * Fetch comprehensive negotiation data from database
   */
  private static async fetchNegotiationData(negotiationId: string) {
    const [negotiation] = await db
      .select()
      .from(negotiations)
      .where(eq(negotiations.id, negotiationId))
      .limit(1);

    if (!negotiation) {
      throw new Error(`Negotiation not found: ${negotiationId}`);
    }

    // Get dimensions
    const dimensions = await db
      .select()
      .from(negotiationDimensions) 
      .where(eq(negotiationDimensions.negotiationId, negotiationId));

    // Get context if available
    let context = null;
    if (negotiation.contextId) {
      const [contextData] = await db
        .select()
        .from(negotiationContexts)
        .where(eq(negotiationContexts.id, negotiation.contextId))
        .limit(1);
      context = contextData;
    }

    return {
      negotiation,
      dimensions,
      context
    };
  }

  /**
   * Fetch technique data from database
   */
  private static async fetchTechniqueData(techniqueId: string) {
    const [technique] = await db
      .select()
      .from(influencingTechniques)
      .where(eq(influencingTechniques.id, techniqueId))
      .limit(1);
    
    return technique;
  }

  /**
   * Fetch tactic data from database
   */
  private static async fetchTacticData(tacticId: string) {
    const [tactic] = await db
      .select()
      .from(negotiationTactics)
      .where(eq(negotiationTactics.id, tacticId))
      .limit(1);
    
    return tactic;
  }

  /**
   * Resume a paused negotiation
   */
  static async resumeNegotiation(
    simulationRunId: string, 
    onRoundUpdate?: RoundUpdateCallback
  ): Promise<PythonNegotiationResult> {
    try {
      // Get the paused simulation run
      const [pausedRun] = await db
        .select()
        .from(simulationRuns)
        .where(eq(simulationRuns.id, simulationRunId))
        .limit(1);

      if (!pausedRun) {
        throw new Error(`Simulation run not found: ${simulationRunId}`);
      }

      if (pausedRun.status !== 'paused') {
        throw new Error(`Simulation run is not paused. Current status: ${pausedRun.status}`);
      }

      // Resume the negotiation with existing conversation log
      const resumeRequest: PythonNegotiationRequest = {
        negotiationId: pausedRun.negotiationId,
        simulationRunId: simulationRunId,
        techniqueId: pausedRun.techniqueId || undefined,
        tacticId: pausedRun.tacticId || undefined,
        maxRounds: 10, // Allow more rounds when resuming
      };

      // Update status to running
      await db
        .update(simulationRuns)
        .set({ status: 'running' })
        .where(eq(simulationRuns.id, simulationRunId));

      // Run the negotiation with existing conversation log
      return await this.runNegotiationWithResume(resumeRequest, pausedRun.conversationLog, onRoundUpdate);
      
    } catch (error) {
      console.error('Resume negotiation error:', error);
      throw error;
    }
  }

  /**
   * Run a negotiation with existing conversation log for resume functionality
   */
  private static async runNegotiationWithResume(
    request: PythonNegotiationRequest, 
    existingConversationLog: string | null,
    onRoundUpdate?: RoundUpdateCallback
  ): Promise<PythonNegotiationResult> {
    try {
      // Fetch comprehensive negotiation data (same as regular runNegotiation)
      const negotiationData = await this.fetchNegotiationData(request.negotiationId);
      
      // Fetch technique and tactic details
      let technique = null;
      let tactic = null;
      
      if (request.techniqueId) {
        technique = await this.fetchTechniqueData(request.techniqueId);
      }
      
      if (request.tacticId) {
        tactic = await this.fetchTacticData(request.tacticId);
      }
      
      // Create comprehensive data package
      const fullNegotiationData = {
        ...negotiationData,
        technique,
        tactic
      };
      
      // Prepare arguments for Python script with existing conversation
      const scriptArgs = [
        'scripts/run_production_negotiation.py',
        '--negotiation-id', request.negotiationId,
        '--simulation-run-id', request.simulationRunId,
        '--max-rounds', (request.maxRounds || 10).toString(),
        '--negotiation-data', JSON.stringify(fullNegotiationData)
      ];

      if (request.techniqueId) {
        scriptArgs.push('--technique-id', request.techniqueId);
      }
      
      if (request.tacticId) {
        scriptArgs.push('--tactic-id', request.tacticId);
      }

      // Add existing conversation log for resume
      if (existingConversationLog) {
        scriptArgs.push('--existing-conversation', existingConversationLog);
      }

      // Execute Python script
      const result = await this.executePythonScript(scriptArgs, onRoundUpdate, request);
      
      // Update simulation run with results
      await this.updateSimulationRun(request.simulationRunId, result);
      
      return result;
      
    } catch (error) {
      console.error('Resume negotiation service error:', error);
      throw error;
    }
  }

  /**
   * Update simulation run with results
   */
  private static async updateSimulationRun(simulationRunId: string, result: PythonNegotiationResult) {
    // Enhanced status mapping for new outcomes
    const statusMapping = {
      'DEAL_ACCEPTED': 'completed',
      'TERMINATED': 'completed',        // Polite end is still successful completion
      'WALK_AWAY': 'failed',           // BATNA-based decision
      'PAUSED': 'paused',              // New status for paused negotiations  
      'MAX_ROUNDS_REACHED': 'timeout',
      'ERROR': 'failed'
    };
    
    const updateData = {
      status: statusMapping[result.outcome] || 'failed',
      conversationLog: JSON.stringify(result.conversationLog),
      totalRounds: result.totalRounds,
      langfuseTraceId: result.langfuseTraceId,
      outcome: result.outcome  // Store the detailed outcome
    };

    // Only set completedAt for truly completed negotiations (not paused ones)
    if (result.outcome !== 'PAUSED') {
      updateData['completedAt'] = new Date();
    }

    if (result.finalOffer) {
      updateData['dimensionResults'] = JSON.stringify(result.finalOffer.dimension_values || {});
    }

    await db
      .update(simulationRuns)
      .set(updateData)
      .where(eq(simulationRuns.id, simulationRunId));
  }
}

/**
 * Factory function for easy usage
 */
export async function runPythonNegotiation(
  negotiationId: string,
  simulationRunId: string,
  options: {
    techniqueId?: string;
    tacticId?: string;
    maxRounds?: number;
  } = {}
): Promise<PythonNegotiationResult> {
  return PythonNegotiationService.runNegotiation({
    negotiationId,
    simulationRunId,
    ...options
  });
}

/**
 * Factory function for resuming paused negotiations
 */
export async function resumePythonNegotiation(
  simulationRunId: string,
  onRoundUpdate?: RoundUpdateCallback
): Promise<PythonNegotiationResult> {
  return PythonNegotiationService.resumeNegotiation(simulationRunId, onRoundUpdate);
}