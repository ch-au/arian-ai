/**
 * Simulation Evaluation Service
 *
 * Uses Langfuse prompt 'simulation_eval' to generate AI insights
 * about technique/tactic effectiveness after simulation completion.
 */

import { spawn } from "child_process";
import path from "path";
import { db } from "../db";
import { simulationRuns } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createRequestLogger } from "./logger";

const log = createRequestLogger("service:simulation-evaluation");

interface EvaluationResult {
  tactical_summary: string;
  influencing_effectiveness_score: number;
  tactic_effectiveness_score: number;
}

interface EvaluationResponse {
  simulationRunId: string;
  evaluation: EvaluationResult;
}

export class SimulationEvaluationService {
  /**
   * Evaluate a completed simulation run using AI
   */
  static async evaluateSimulationRun(
    simulationRunId: string,
    conversationLog: any[],
    role: string,
    influenceTechniqueName: string,
    techniqueDescription: string,
    negotiationTacticName: string,
    tacticDescription: string,
    counterpartAttitude: string,
    outcome: string,
  ): Promise<EvaluationResult> {
    log.info(
      {
        simulationRunId: simulationRunId.slice(0, 8),
        role,
        technique: influenceTechniqueName,
        tactic: negotiationTacticName,
        outcome,
        conversationRounds: conversationLog?.length || 0
      },
      "[EVALUATION] Starting AI evaluation"
    );

    // Validate inputs
    if (!conversationLog || conversationLog.length === 0) {
      log.warn({ simulationRunId: simulationRunId.slice(0, 8) }, "[EVALUATION] Empty conversation log - cannot evaluate");
      throw new Error("Empty conversation log - cannot evaluate");
    }

    if (!influenceTechniqueName || !negotiationTacticName) {
      log.warn(
        {
          simulationRunId: simulationRunId.slice(0, 8),
          hasTechnique: !!influenceTechniqueName,
          hasTactic: !!negotiationTacticName
        },
        "[EVALUATION] Missing technique or tactic name - cannot evaluate"
      );
      throw new Error("Missing technique or tactic name - cannot evaluate");
    }

    const scriptPath = path.join(process.cwd(), "scripts", "evaluate_simulation.py");
    const pythonPath = path.join(process.cwd(), ".venv", "bin", "python3");

    const conversationLogJson = JSON.stringify(conversationLog);

    log.debug({
      simulationRunId: simulationRunId.slice(0, 8),
      scriptPath,
      pythonPath,
      conversationLogSize: conversationLogJson.length,
      conversationRounds: conversationLog.length
    }, "[EVALUATION] Spawning Python evaluation process");

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonPath, [
        scriptPath,
        "--simulation-run-id", simulationRunId,
        "--conversation-log", conversationLogJson,
        "--role", role,
        "--technique-name", influenceTechniqueName,
        "--technique-description", techniqueDescription,
        "--tactic-name", negotiationTacticName,
        "--tactic-description", tacticDescription,
        "--counterpart-attitude", counterpartAttitude,
        "--outcome", outcome,
      ]);

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
        log.debug({ simulationRunId: simulationRunId.slice(0, 8), length: data.length }, "[EVALUATION] Python stdout chunk received");
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        const stderrText = data.toString().trim();
        // Only warn if it's not just INFO/DEBUG logs
        if (stderrText && !stderrText.includes('[INFO]') && !stderrText.includes('[DEBUG]')) {
          log.warn({ simulationRunId: simulationRunId.slice(0, 8), stderr: stderrText }, "[EVALUATION] Python stderr");
        } else {
          log.debug({ simulationRunId: simulationRunId.slice(0, 8), stderr: stderrText }, "[EVALUATION] Python log");
        }
      });

      pythonProcess.on("close", (code) => {
        const duration = Date.now() - startTime;

        if (code !== 0) {
          log.error(
            {
              simulationRunId: simulationRunId.slice(0, 8),
              exitCode: code,
              duration,
              stderr: stderr.slice(-500), // Last 500 chars of stderr
              stdout: stdout.slice(-200)  // Last 200 chars of stdout
            },
            "[EVALUATION] Python process exited with non-zero code"
          );
          reject(new Error(`Evaluation failed with exit code ${code}: ${stderr.slice(-200)}`));
          return;
        }

        try {
          const response: EvaluationResponse = JSON.parse(stdout);
          log.info(
            {
              simulationRunId: simulationRunId.slice(0, 8),
              duration,
              techniqueScore: response.evaluation.influencing_effectiveness_score,
              tacticScore: response.evaluation.tactic_effectiveness_score,
              summaryLength: response.evaluation.tactical_summary?.length || 0
            },
            "[EVALUATION] ✓ Generated evaluation successfully"
          );
          resolve(response.evaluation);
        } catch (error) {
          log.error(
            {
              err: error,
              simulationRunId: simulationRunId.slice(0, 8),
              duration,
              stdoutPreview: stdout.slice(0, 500),
              stdoutLength: stdout.length
            },
            "[EVALUATION] Failed to parse Python output as JSON"
          );
          reject(new Error(`Failed to parse evaluation output: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });

      pythonProcess.on("error", (error) => {
        const duration = Date.now() - startTime;
        log.error(
          {
            err: error,
            simulationRunId: simulationRunId.slice(0, 8),
            duration,
            pythonPath,
            scriptPath
          },
          "[EVALUATION] Failed to spawn Python process - check Python installation"
        );
        reject(new Error(`Failed to spawn evaluation process: ${error.message}`));
      });
    });
  }

  /**
   * Save evaluation results to database
   */
  static async saveEvaluation(
    simulationRunId: string,
    evaluation: EvaluationResult,
  ): Promise<void> {
    log.info(
      {
        simulationRunId: simulationRunId.slice(0, 8),
        techniqueScore: evaluation.influencing_effectiveness_score,
        tacticScore: evaluation.tactic_effectiveness_score,
        summaryLength: evaluation.tactical_summary?.length || 0
      },
      "[EVALUATION] Saving evaluation to database"
    );

    try {
      await db.update(simulationRuns)
        .set({
          tacticalSummary: evaluation.tactical_summary,
          techniqueEffectivenessScore: evaluation.influencing_effectiveness_score.toString(),
          tacticEffectivenessScore: evaluation.tactic_effectiveness_score.toString(),
        })
        .where(eq(simulationRuns.id, simulationRunId));

      log.info({ simulationRunId: simulationRunId.slice(0, 8) }, "[EVALUATION] ✓ Evaluation saved successfully to database");
    } catch (error) {
      log.error(
        {
          err: error,
          simulationRunId: simulationRunId.slice(0, 8)
        },
        "[EVALUATION] Failed to save evaluation to database"
      );
      throw error;
    }
  }

  /**
   * Evaluate and save in one step
   */
  static async evaluateAndSave(
    simulationRunId: string,
    conversationLog: any[],
    role: string,
    influenceTechniqueName: string,
    techniqueDescription: string,
    negotiationTacticName: string,
    tacticDescription: string,
    counterpartAttitude: string,
    outcome: string,
  ): Promise<EvaluationResult> {
    log.debug(
      {
        simulationRunId: simulationRunId.slice(0, 8),
        role,
        technique: influenceTechniqueName,
        tactic: negotiationTacticName
      },
      "[EVALUATION] Starting evaluate-and-save workflow"
    );

    const evaluation = await this.evaluateSimulationRun(
      simulationRunId,
      conversationLog,
      role,
      influenceTechniqueName,
      techniqueDescription,
      negotiationTacticName,
      tacticDescription,
      counterpartAttitude,
      outcome,
    );

    await this.saveEvaluation(simulationRunId, evaluation);

    log.info({ simulationRunId: simulationRunId.slice(0, 8) }, "[EVALUATION] ✓ Complete evaluation workflow finished");

    return evaluation;
  }
}
