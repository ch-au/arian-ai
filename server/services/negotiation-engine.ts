import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { storage, type NegotiationRecord, type SimulationRun } from "../storage";
import type { PythonNegotiationResult } from "./python-negotiation-service";
import { createRequestLogger } from "./logger";

export interface NegotiationUpdate {
  type: "negotiation_started" | "round_completed" | "negotiation_completed" | "error";
  negotiationId: string;
  data: any;
}

export class NegotiationEngine {
  private readonly wss: WebSocketServer;
  private readonly log = createRequestLogger("service:negotiation-engine");
  private readonly abortedNegotiations = new Set<string>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
    });

    this.wss.on("connection", (ws: WebSocket) => {
      this.log.debug({ event: "ws_connected" }, "WebSocket client connected");
      ws.on("message", (message) => this.handleWebSocketMessage(ws, message.toString()));
    });
  }

  private handleWebSocketMessage(ws: WebSocket, payload: string) {
    try {
      const data = JSON.parse(payload);
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (error) {
      this.log.warn({ err: error }, "Invalid WebSocket payload");
    }
  }

  private broadcast(update: NegotiationUpdate) {
    const message = JSON.stringify(update);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async startNegotiation(negotiationId: string): Promise<void> {
    const negotiation = await storage.getNegotiation(negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    this.abortedNegotiations.delete(negotiationId);
    await storage.startNegotiation(negotiationId);
    this.broadcast({ type: "negotiation_started", negotiationId, data: { negotiation } });
    await this.runSimulationMatrix(negotiationId);
  }

  async stopNegotiation(negotiationId: string): Promise<void> {
    this.abortedNegotiations.add(negotiationId);
    const { PythonNegotiationService } = await import("./python-negotiation-service");
    await PythonNegotiationService.cancelNegotiation(negotiationId);
    const pendingRuns = await storage.getSimulationRuns(negotiationId);
    await Promise.all(
      pendingRuns.map((run) => {
        if (this.isTerminalStatus(run.status)) {
          return Promise.resolve();
        }
        return storage.updateSimulationRun(run.id, {
          status: "aborted",
          outcome: "ABORTED",
          outcomeReason: "Abgebrochen durch Benutzer",
          completedAt: new Date(),
        });
      }),
    );
    await storage.updateNegotiationStatus(negotiationId, "aborted");
    this.broadcast({ type: "negotiation_completed", negotiationId, data: { status: "aborted" } });
  }

  getActiveNegotiationsCount(): number {
    return this.wss.clients.size;
  }

  private async runSimulationMatrix(negotiationId: string) {
    const runs = await storage.getSimulationRuns(negotiationId);
    for (const run of runs) {
      if (this.abortedNegotiations.has(negotiationId)) {
        if (!this.isTerminalStatus(run.status)) {
          await storage.updateSimulationRun(run.id, {
            status: "aborted",
            outcome: "ABORTED",
            outcomeReason: "Abgebrochen bevor Ausführung",
            completedAt: new Date(),
          });
        }
        continue;
      }
      if (this.isTerminalStatus(run.status)) {
        continue;
      }
      try {
        await this.runSingleSimulation(run);
      } catch (error) {
        if (this.abortedNegotiations.has(negotiationId) || (error instanceof Error && error.message === "SIMULATION_ABORTED")) {
          await storage.updateSimulationRun(run.id, {
            status: "aborted",
            outcome: "ABORTED",
            outcomeReason: "Abgebrochen während Ausführung",
            completedAt: new Date(),
          });
          continue;
        }
        this.log.error({ err: error, runId: run.id }, "Simulation run failed");
        await storage.updateSimulationRun(run.id, { status: "failed" });
      }
    }
  }

  private async runSingleSimulation(run: SimulationRun) {
    if (!run.negotiationId) {
      throw new Error("Simulation run has no associated negotiation");
    }
    const negotiation = await storage.getNegotiation(run.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    if (this.abortedNegotiations.has(negotiation.id)) {
      await storage.updateSimulationRun(run.id, {
        status: "aborted",
        outcome: "ABORTED",
        outcomeReason: "Abgebrochen bevor Start",
        completedAt: new Date(),
      });
      return;
    }

    const { PythonNegotiationService } = await import("./python-negotiation-service");
    try {
      const result = await PythonNegotiationService.runNegotiation(
        {
          negotiationId: negotiation.id,
          simulationRunId: run.id,
          techniqueId: run.techniqueId ?? undefined,
          tacticId: run.tacticId ?? undefined,
          maxRounds: negotiation.scenario.maxRounds ?? 6,
        },
        (roundUpdate) => {
          this.broadcast({ type: "round_completed", negotiationId: negotiation.id, data: roundUpdate });
        },
      );

      if (this.abortedNegotiations.has(negotiation.id)) {
        return;
      }

      await this.processSimulationResult(negotiation, result);
    } catch (error) {
      if (this.abortedNegotiations.has(negotiation.id) || (error instanceof Error && error.message === "SIMULATION_ABORTED")) {
        await storage.updateSimulationRun(run.id, {
          status: "aborted",
          outcome: "ABORTED",
          outcomeReason: "Abgebrochen während Ausführung",
          completedAt: new Date(),
        });
        throw new Error("SIMULATION_ABORTED");
      }
      throw error;
    }
  }

  private async processSimulationResult(negotiation: NegotiationRecord, result: PythonNegotiationResult) {
    this.broadcast({
      type: "negotiation_completed",
      negotiationId: negotiation.id,
      data: {
        outcome: result.outcome,
        totalRounds: result.totalRounds,
        conversationLog: result.conversationLog,
        finalOffer: result.finalOffer,
        langfuseTraceId: result.langfuseTraceId,
      },
    });
  }

  private isTerminalStatus(status?: string | null) {
    return ["completed", "failed", "timeout", "aborted"].includes((status ?? "").toLowerCase());
  }
}
