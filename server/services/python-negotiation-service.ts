/**
 * Python Negotiation Microservice Bridge
 * Executes negotiations using the Python OpenAI Agents implementation
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { db } from '../db';
import { storage } from '../storage';
import { simulationRuns, influencingTechniques, negotiationTactics, registrations, markets, counterparts } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { createRequestLogger } from './logger';

export interface PythonNegotiationRequest {
  negotiationId: string;
  simulationRunId: string;
  techniqueId?: string;
  tacticId?: string;
  maxRounds?: number;
  queueId?: string;
  selfAgentPromptName?: string;
  opponentAgentPromptName?: string;
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
    message: string;
    offer?: any;
    action?: string;
    internal_analysis?: string;
    batna_assessment?: number;
    walk_away_threshold?: number;
  }>;
  langfuseTraceId?: string;
}

export class PythonNegotiationService {
  private static log = createRequestLogger('service:python-negotiation');
  private static activeProcesses = new Map<string, { process: ChildProcess; negotiationId?: string }>();
  private static cancelledRuns = new Set<string>();

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

      scriptArgs.push('--self-agent-prompt', request.selfAgentPromptName ?? 'agents/self_agent');
      scriptArgs.push('--opponent-agent-prompt', request.opponentAgentPromptName ?? 'agents/opponent_agent');

      // Execute Python script
      const result = await this.executePythonScript(scriptArgs, request.simulationRunId, onRoundUpdate, request);

      // NOTE: Do NOT update simulation run here - let simulation-queue.ts handle all updates
      // This prevents race conditions where status changes before deal value calculation

      return result;
      
    } catch (error) {
      this.log.error({ err: error, request }, 'Python negotiation service error');
      throw error;
    }
  }

  /**
   * Execute the Python negotiation script
   */
  private static executePythonScript(
    args: string[],
    simulationRunId: string,
    onRoundUpdate?: RoundUpdateCallback,
    request?: PythonNegotiationRequest
  ): Promise<PythonNegotiationResult> {
    return new Promise((resolve, reject) => {
      const pythonExec = existsSync('./.venv/bin/python')
        ? './.venv/bin/python'
        : (existsSync('/usr/bin/python3') ? 'python3' : 'python');

      this.log.info(`[PYTHON-EXEC] Spawning: ${pythonExec} ${args[0]}`);
      this.log.info(`[PYTHON-EXEC] Args: ${JSON.stringify(args.slice(1, 5))}...`); // Log first few args

      const pythonProcess = spawn(pythonExec, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONPATH: process.cwd()
        }
      });
      this.activeProcesses.set(simulationRunId, { process: pythonProcess, negotiationId: request?.negotiationId });

      let stdout = '';
      let stderr = '';
      let buffer = '';
      let resolved = false;

      // Add timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.log.error('[PYTHON-EXEC] ❌ Python script timeout after 5 minutes');
          pythonProcess.kill('SIGTERM');
          this.activeProcesses.delete(simulationRunId);
          reject(new Error('Python script execution timeout (5 minutes)'));
        }
      }, 5 * 60 * 1000); // 5 minute timeout

      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        this.log.info(`[PYTHON-EXEC] stdout chunk: ${chunk.substring(0, 100)}...`);

        // Parse real-time updates from Python output immediately
        if (onRoundUpdate && request) {
          this.parseRoundUpdates(chunk, onRoundUpdate, request);
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        this.log.warn(`[PYTHON-EXEC] stderr: ${chunk}`);
      });

      pythonProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.activeProcesses.delete(simulationRunId);
          this.log.error({ err: error }, '[PYTHON-EXEC] ❌ Process error');
          reject(new Error(`Failed to spawn Python process: ${error.message}`));
        }
      });

      pythonProcess.on('close', (code) => {
        if (resolved) return; // Already handled by timeout or error
        resolved = true;
        clearTimeout(timeout);
        this.activeProcesses.delete(simulationRunId);

        this.log.info(`[PYTHON-EXEC] Process closed with code ${code}`);

        if (code !== 0) {
          if (this.cancelledRuns.has(simulationRunId)) {
            this.cancelledRuns.delete(simulationRunId);
            reject(new Error('SIMULATION_ABORTED'));
            return;
          }
          this.log.error(`[PYTHON-EXEC] ❌ Non-zero exit code: ${code}`);
          this.log.error(`[PYTHON-EXEC] stderr: ${stderr}`);
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON result from stdout, filtering out trace logs and ROUND_UPDATE lines
          const lines = stdout.split('\n');
          let jsonOutput = '';
          
          // Find the final JSON output - look for lines that start with { (valid JSON)
          // and exclude trace logs and ROUND_UPDATE lines
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && 
                !line.startsWith('ROUND_UPDATE:') && 
                !line.includes('OpenAI Agents trace:') &&
                !line.includes('Agent run:') &&
                !line.includes('Responses API with') &&
                !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3}/) && // Filter out timestamps
                (trimmedLine.startsWith('{') || jsonOutput)) {
              jsonOutput += line + '\n';
            }
          }
          
          if (!jsonOutput.trim()) {
            this.log.error({ args, stdout, stderr }, 'No JSON output from Python script');
            reject(new Error('No JSON output found from Python script'));
            return;
          }

          const result = JSON.parse(jsonOutput.trim());
          resolve(result);
        } catch (parseError) {
          this.log.error(
            {
              err: parseError,
              stdoutPreview: stdout.substring(0, 500),
              stderrPreview: stderr.substring(0, 500),
              args,
            },
            'Failed to parse Python output',
          );
          reject(new Error(`Failed to parse Python script output: ${parseError}`));
        }
      });

      pythonProcess.on('error', (error) => {
        this.log.error({ err: error, args }, 'Failed to start Python process');
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Cancel all currently running simulations for the negotiation.
   */
  static async cancelNegotiation(negotiationId: string) {
    const matchingProcesses = Array.from(this.activeProcesses.entries()).filter(
      ([, entry]) => entry.negotiationId === negotiationId,
    );

    if (matchingProcesses.length === 0) {
      return;
    }

    for (const [runId, entry] of matchingProcesses) {
      try {
        this.log.warn(`[PYTHON-EXEC] Cancelling simulation run ${runId} for negotiation ${negotiationId}`);
        this.cancelledRuns.add(runId);
        entry.process.kill("SIGTERM");
        this.activeProcesses.delete(runId);
        await this.markRunAsAborted(runId, "Abgebrochen durch Benutzer");
      } catch (error) {
        this.log.error({ err: error, runId, negotiationId }, "Failed to cancel simulation run");
      }
    }
  }

  private static async markRunAsAborted(runId: string, reason: string) {
    try {
      await storage.updateSimulationRun(runId, {
        status: "aborted",
        outcome: "ABORTED",
        outcomeReason: reason,
        completedAt: new Date(),
      });
    } catch (error) {
      this.log.error({ err: error, runId }, "Failed to mark simulation run as aborted");
    }
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
          this.log.debug({ round: roundData.round, agent: roundData.agent }, 'Emitting round update');

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
          this.log.warn({ err: error, line }, 'Failed to parse round update');
        }
      }
    }
  }

  /**
   * Fetch comprehensive negotiation data from database
   */
  private static async fetchNegotiationData(negotiationId: string) {
    const negotiation = await storage.getNegotiation(negotiationId);
    if (!negotiation) {
      throw new Error(`Negotiation not found: ${negotiationId}`);
    }

    const products = await storage.getProductsByNegotiation(negotiationId);
    const dimensions = negotiation.scenario.dimensions ?? [];

    const [registration] = negotiation.registrationId
      ? await db
          .select()
          .from(registrations)
          .where(eq(registrations.id, negotiation.registrationId))
          .limit(1)
      : [null];

    const [market] = negotiation.marketId
      ? await db
          .select()
          .from(markets)
          .where(eq(markets.id, negotiation.marketId))
          .limit(1)
      : [null];

    const [counterpart] = negotiation.counterpartId
      ? await db
          .select()
          .from(counterparts)
          .where(eq(counterparts.id, negotiation.counterpartId))
          .limit(1)
      : [null];

    return {
      negotiation,
      registration,
      market,
      counterpart,
      dimensions,
      products,
      context: negotiation.scenario,
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
      if (!pausedRun.negotiationId) {
        throw new Error("Paused simulation run is missing negotiationId");
      }

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
      const existingConversation = typeof pausedRun.conversationLog === 'string'
        ? pausedRun.conversationLog
        : pausedRun.conversationLog
        ? JSON.stringify(pausedRun.conversationLog)
        : null;

      return await this.runNegotiationWithResume(resumeRequest, existingConversation, onRoundUpdate);

    } catch (error) {
      this.log.error({ err: error, simulationRunId }, 'Resume negotiation error');
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

      scriptArgs.push('--self-agent-prompt', request.selfAgentPromptName ?? 'agents/self_agent');
      scriptArgs.push('--opponent-agent-prompt', request.opponentAgentPromptName ?? 'agents/opponent_agent');

      // Execute Python script
      const result = await this.executePythonScript(scriptArgs, request.simulationRunId, onRoundUpdate, request);

      // NOTE: Do NOT update simulation run here - let simulation-queue.ts handle all updates
      // This prevents race conditions where status changes before deal value calculation

      return result;

    } catch (error) {
      this.log.error({ err: error, request, existingConversationLog }, 'Resume negotiation service error');
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
      'WALK_AWAY': 'completed',        // BATNA-based decision is a valid completion
      'PAUSED': 'paused',              // New status for paused negotiations
      'MAX_ROUNDS_REACHED': 'timeout',
      'ERROR': 'failed'
    } as const;

    const normalizedConversationLog = Array.isArray(result.conversationLog)
      ? result.conversationLog
      : [];

    const dimensionValues = result.finalOffer?.dimension_values ?? {};

    // Get simulation run to find negotiationId
    const [simulationRun] = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.id, simulationRunId))
      .limit(1);

    if (!simulationRun) {
      throw new Error(`Simulation run not found: ${simulationRunId}`);
    }

    const updateData: any = {
      status: statusMapping[result.outcome] || 'failed',
      conversationLog: normalizedConversationLog,
      totalRounds: result.totalRounds,
      langfuseTraceId: result.langfuseTraceId || null,
      outcome: result.outcome, // Store the detailed outcome
      otherDimensions: dimensionValues,
    };

    // Only set completedAt for truly completed negotiations (not paused ones)
    if (result.outcome !== 'PAUSED') {
      updateData.completedAt = new Date();
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
