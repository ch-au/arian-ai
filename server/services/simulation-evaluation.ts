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
    negotiationTacticName: string,
    counterpartAttitude: string,
  ): Promise<EvaluationResult> {
    console.log(`[EVALUATION] Starting AI evaluation for simulation ${simulationRunId}`);

    const scriptPath = path.join(process.cwd(), "scripts", "evaluate_simulation.py");
    const pythonPath = path.join(process.cwd(), ".venv", "bin", "python3");

    const conversationLogJson = JSON.stringify(conversationLog);

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonPath, [
        scriptPath,
        "--simulation-run-id", simulationRunId,
        "--conversation-log", conversationLogJson,
        "--role", role,
        "--influence-technique", influenceTechniqueName,
        "--negotiation-tactic", negotiationTacticName,
        "--counterpart-attitude", counterpartAttitude,
      ]);

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log(`[EVALUATION] stderr: ${data.toString().trim()}`);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`[EVALUATION] Python process exited with code ${code}`);
          console.error(`[EVALUATION] stderr: ${stderr}`);
          reject(new Error(`Evaluation failed with code ${code}`));
          return;
        }

        try {
          const response: EvaluationResponse = JSON.parse(stdout);
          console.log(`[EVALUATION] Generated evaluation:`, response.evaluation);
          resolve(response.evaluation);
        } catch (error) {
          console.error(`[EVALUATION] Failed to parse Python output:`, error);
          console.error(`[EVALUATION] stdout:`, stdout);
          reject(error);
        }
      });

      pythonProcess.on("error", (error) => {
        console.error(`[EVALUATION] Failed to spawn Python process:`, error);
        reject(error);
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
    console.log(`[EVALUATION] Saving evaluation for simulation ${simulationRunId}`);

    await db.update(simulationRuns)
      .set({
        tacticalSummary: evaluation.tactical_summary,
        techniqueEffectivenessScore: evaluation.influencing_effectiveness_score.toString(),
        tacticEffectivenessScore: evaluation.tactic_effectiveness_score.toString(),
      })
      .where(eq(simulationRuns.id, simulationRunId));

    console.log(`[EVALUATION] Evaluation saved successfully`);
  }

  /**
   * Evaluate and save in one step
   */
  static async evaluateAndSave(
    simulationRunId: string,
    conversationLog: any[],
    role: string,
    influenceTechniqueName: string,
    negotiationTacticName: string,
    counterpartAttitude: string,
  ): Promise<EvaluationResult> {
    const evaluation = await this.evaluateSimulationRun(
      simulationRunId,
      conversationLog,
      role,
      influenceTechniqueName,
      negotiationTacticName,
      counterpartAttitude,
    );

    await this.saveEvaluation(simulationRunId, evaluation);

    return evaluation;
  }
}
