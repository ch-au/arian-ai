/**
 * Playbook Generator Service
 *
 * Generates negotiation playbooks using LLM after all simulations are complete.
 */

import { spawn } from "child_process";
import path from "path";
import { createRequestLogger } from "./logger";

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

// Timeout for playbook generation (7 minutes - allows for 6 min LLM call + overhead)
const PLAYBOOK_TIMEOUT_MS = 7 * 60 * 1000;

export class PlaybookGeneratorService {
  /**
   * Generate a negotiation playbook for a completed negotiation
   */
  static async generatePlaybook(negotiationId: string): Promise<PlaybookResult> {
    log.info({ negotiationId: negotiationId.slice(0, 8) }, "[PLAYBOOK] Starting playbook generation");

    const scriptPath = path.join(process.cwd(), "scripts", "generate_playbook.py");
    const pythonPath = process.env.PYTHON_PATH || "python";

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonPath, [
        scriptPath,
        `--negotiation-id=${negotiationId}`,
      ]);

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
    });
  }
}
