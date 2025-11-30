/**
 * Playbook Generator Service
 *
 * Generates negotiation playbooks using LLM after all simulations are complete.
 * Follows the same pattern as simulation runs: Node.js fetches data, Python does LLM.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { createRequestLogger } from "./logger";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { registrations, counterparts, influencingTechniques, negotiationTactics } from "../../shared/schema";

const log = createRequestLogger("service:playbook-generator");

export interface PlaybookResult {
  success: boolean;
  playbook?: string;
  error?: string;
  metadata?: {
    negotiation_id: string;
    company_name: string;
    opponent_name: string;
    negotiation_title: string;
    model: string;
    prompt_version: number;
  };
}

interface PlaybookInputData {
  negotiation_id: string;
  company_name: string;
  opponent_name: string;
  negotiation_title: string;
  description: string;
  user_role: string;
  user_role_label: string;
  opponent_role_label: string;
  simulation_runs: Array<{
    id: string;
    run_number: number | null;
    technique_name: string;
    tactic_name: string;
    status: string;
    outcome: string | null;
    outcome_reason: string | null;
    deal_value: number | null;
    total_rounds: number | null;
    conversation_log: unknown[];
    summary: Record<string, unknown>;
  }>;
}

// Timeout for playbook generation (7 minutes - allows for 6 min LLM call + overhead)
const PLAYBOOK_TIMEOUT_MS = 7 * 60 * 1000;

export class PlaybookGeneratorService {
  /**
   * Fetch all data needed for playbook generation from database
   */
  private static async fetchPlaybookData(negotiationId: string): Promise<PlaybookInputData> {
    // Get negotiation
    const negotiation = await storage.getNegotiation(negotiationId);
    if (!negotiation) {
      throw new Error(`Negotiation ${negotiationId} not found`);
    }

    // Get registration (company name)
    let companyName = "Ihr Unternehmen";
    if (negotiation.registrationId) {
      const [registration] = await db
        .select()
        .from(registrations)
        .where(eq(registrations.id, negotiation.registrationId));
      if (registration) {
        companyName = registration.company || registration.organization || companyName;
      }
    }

    // Get counterpart (opponent name)
    let opponentName = "Verhandlungspartner";
    if (negotiation.counterpartId) {
      const [counterpart] = await db
        .select()
        .from(counterparts)
        .where(eq(counterparts.id, negotiation.counterpartId));
      if (counterpart) {
        opponentName = counterpart.name || opponentName;
      }
    }

    // Fallback to scenario if relational data is missing
    if (negotiation.scenario) {
      const scenario = negotiation.scenario as Record<string, unknown>;
      if (companyName === "Ihr Unternehmen" && scenario.companyProfile) {
        const profile = scenario.companyProfile as Record<string, unknown>;
        companyName = (profile.company as string) || (profile.organization as string) || companyName;
      }
    }

    // Determine user role and labels
    const userRole = (negotiation.scenario as Record<string, unknown>)?.userRole as string || "seller";
    const userRoleLabel = userRole === "buyer" ? "Käufer" : "Verkäufer";
    const opponentRoleLabel = userRole === "buyer" ? "Verkäufer" : "Käufer";

    // Get all simulation runs
    const simulationRuns = await storage.getSimulationRuns(negotiationId);

    // Get all techniques and tactics for name lookup
    const techniques = await db.select().from(influencingTechniques);
    const tactics = await db.select().from(negotiationTactics);

    const techniqueMap = new Map(techniques.map(t => [t.id, t.name]));
    const tacticMap = new Map(tactics.map(t => [t.id, t.name]));

    // Map simulation runs to playbook format
    const mappedRuns = simulationRuns.map(run => ({
      id: run.id,
      run_number: run.runNumber,
      technique_name: run.techniqueId ? techniqueMap.get(run.techniqueId) || "Unbekannt" : "Unbekannt",
      tactic_name: run.tacticId ? tacticMap.get(run.tacticId) || "Unbekannt" : "Unbekannt",
      status: run.status,
      outcome: run.outcome,
      outcome_reason: run.outcomeReason,
      deal_value: run.dealValue ? Number(run.dealValue) : null,
      total_rounds: run.totalRounds,
      conversation_log: (run.conversationLog as unknown[]) || [],
      summary: {
        outcome: run.outcome,
        dealValue: run.dealValue ? Number(run.dealValue) : null,
        totalRounds: run.totalRounds,
        status: run.status,
      },
    }));

    return {
      negotiation_id: negotiationId,
      company_name: companyName,
      opponent_name: opponentName,
      negotiation_title: negotiation.title || "Verhandlung",
      description: negotiation.description || "",
      user_role: userRole,
      user_role_label: userRoleLabel,
      opponent_role_label: opponentRoleLabel,
      simulation_runs: mappedRuns,
    };
  }

  /**
   * Generate a negotiation playbook for a completed negotiation
   */
  static async generatePlaybook(negotiationId: string): Promise<PlaybookResult> {
    log.info({ negotiationId: negotiationId.slice(0, 8) }, "[PLAYBOOK] Starting playbook generation");

    try {
      // Step 1: Fetch all data from database (Node.js side)
      log.info({ negotiationId: negotiationId.slice(0, 8) }, "[PLAYBOOK] Fetching data from database");
      const playbookData = await this.fetchPlaybookData(negotiationId);
      log.info(
        {
          negotiationId: negotiationId.slice(0, 8),
          runsCount: playbookData.simulation_runs.length,
          companyName: playbookData.company_name,
        },
        "[PLAYBOOK] Data fetched successfully"
      );

      // Step 2: Call Python script with data via stdin
      const scriptPath = path.join(process.cwd(), "scripts", "generate_playbook.py");
      const pythonPath = existsSync("./.venv/bin/python")
        ? "./.venv/bin/python"
        : existsSync("/usr/bin/python3")
        ? "python3"
        : process.env.PYTHON_PATH || "python";

      const startTime = Date.now();

      return new Promise((resolve) => {
        const pythonProcess = spawn(pythonPath, [
          scriptPath,
          "--mode=stdin",  // Tell Python to read from stdin
        ], {
          env: {
            ...process.env,
            PYTHONPATH: process.cwd(),
          },
        });

        // Set timeout to kill process if it takes too long
        const timeout = setTimeout(() => {
          log.error(
            { negotiationId: negotiationId.slice(0, 8), timeoutMs: PLAYBOOK_TIMEOUT_MS },
            "[PLAYBOOK] Generation timeout - killing process"
          );
          pythonProcess.kill("SIGTERM");
          resolve({
            success: false,
            error: `Playbook generation timeout after ${PLAYBOOK_TIMEOUT_MS / 1000} seconds`,
          });
        }, PLAYBOOK_TIMEOUT_MS);

        let stdoutData = "";
        let stderrData = "";

        pythonProcess.stdout.on("data", (data) => {
          stdoutData += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
          const stderr = data.toString();
          stderrData += stderr;
          // Log Python stderr for debugging
          log.debug({ negotiationId: negotiationId.slice(0, 8), stderr }, "[PLAYBOOK] Python stderr");
        });

        pythonProcess.on("close", (code) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;

          if (code !== 0) {
            log.error(
              {
                negotiationId: negotiationId.slice(0, 8),
                code,
                duration,
                stderr: stderrData,
              },
              "[PLAYBOOK] Generation failed"
            );
            resolve({
              success: false,
              error: `Process exited with code ${code}: ${stderrData}`,
            });
            return;
          }

          try {
            const result: PlaybookResult = JSON.parse(stdoutData);

            if (result.success) {
              log.info(
                {
                  negotiationId: negotiationId.slice(0, 8),
                  duration,
                  playbookLength: result.playbook?.length,
                  model: result.metadata?.model,
                },
                "[PLAYBOOK] Generation successful"
              );
            } else {
              log.error(
                {
                  negotiationId: negotiationId.slice(0, 8),
                  duration,
                  error: result.error,
                },
                "[PLAYBOOK] Generation returned error"
              );
            }

            resolve(result);
          } catch (parseError) {
            log.error(
              {
                negotiationId: negotiationId.slice(0, 8),
                parseError,
                stdout: stdoutData.slice(0, 500),
              },
              "[PLAYBOOK] Failed to parse result"
            );
            resolve({
              success: false,
              error: `Failed to parse result: ${parseError}`,
            });
          }
        });

        pythonProcess.on("error", (error) => {
          clearTimeout(timeout);
          log.error(
            {
              negotiationId: negotiationId.slice(0, 8),
              error: error.message,
            },
            "[PLAYBOOK] Failed to spawn Python process"
          );
          resolve({
            success: false,
            error: `Failed to spawn process: ${error.message}`,
          });
        });

        // Write data to stdin and close
        const jsonData = JSON.stringify(playbookData);
        log.debug(
          { negotiationId: negotiationId.slice(0, 8), dataSize: jsonData.length },
          "[PLAYBOOK] Writing data to Python stdin"
        );
        pythonProcess.stdin.write(jsonData);
        pythonProcess.stdin.end();
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(
        { negotiationId: negotiationId.slice(0, 8), error: errorMessage },
        "[PLAYBOOK] Failed to prepare playbook data"
      );
      return {
        success: false,
        error: `Failed to prepare data: ${errorMessage}`,
      };
    }
  }
}
