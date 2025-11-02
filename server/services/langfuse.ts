import { Langfuse } from "langfuse";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { createRequestLogger } from "./logger";

const log = createRequestLogger("service:langfuse");

interface PromptConfig {
  negotiation_prompts: {
    system_prompt: string;
    personality_prompts: {
      [key: string]: {
        opening: string;
        response: string;
      };
    };
    zopa_prompts: {
      within_range: string;
      outside_range: string;
      near_limits: string;
    };
    context_templates: {
      [key: string]: {
        scenario: string;
      };
    };
    closing_prompts: {
      successful_close: string;
      impasse: string;
    };
  };
}

class LangfuseService {
  private langfuse: Langfuse;
  private prompts: PromptConfig | null = null;

  constructor() {
    this.langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
    });

    this.loadPrompts();
  }

  private loadPrompts() {
    try {
      const promptsPath = path.join(process.cwd(), 'server', 'config', 'prompts.yaml');
      const fileContents = fs.readFileSync(promptsPath, 'utf8');
      this.prompts = yaml.load(fileContents) as PromptConfig;
    } catch (error) {
      log.error({ err: error }, 'Failed to load prompts.yaml');
      this.prompts = null;
    }
  }

  // Reload prompts from file (useful for hot-reloading during development)
  reloadPrompts() {
    this.loadPrompts();
  }

  // Get system prompt
  getSystemPrompt(): string {
    return this.prompts?.negotiation_prompts.system_prompt || 
      "You are an expert negotiation agent. Respond professionally and strategically.";
  }

  // Get personality-specific prompts
  getPersonalityPrompt(personality: string, type: 'opening' | 'response'): string {
    const personalityPrompts = this.prompts?.negotiation_prompts.personality_prompts;
    return personalityPrompts?.[personality]?.[type] || 
      `Act with a ${personality} negotiation style.`;
  }

  // Get ZOPA-specific prompts
  getZopaPrompt(situation: 'within_range' | 'outside_range' | 'near_limits'): string {
    return this.prompts?.negotiation_prompts.zopa_prompts[situation] || 
      "Consider your negotiation boundaries when responding.";
  }

  // Get context template
  getContextTemplate(contextType: string): string {
    return this.prompts?.negotiation_prompts.context_templates[contextType]?.scenario || 
      `You are negotiating a ${contextType} agreement.`;
  }

  // Get closing prompts
  getClosingPrompt(outcome: 'successful_close' | 'impasse'): string {
    return this.prompts?.negotiation_prompts.closing_prompts[outcome] || 
      "Conclude the negotiation appropriately.";
  }

  // Create a trace for a negotiation
  createTrace(negotiationId: string, metadata?: any) {
    return this.langfuse.trace({
      id: negotiationId,
      name: "AI Negotiation",
      metadata: {
        negotiationId,
        platform: "ARIAN",
        ...metadata
      }
    });
  }

  // Create a generation within a trace
  createGeneration(trace: any, config: {
    name: string;
    model: string;
    input: any;
    output?: any;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    startTime?: Date;
    endTime?: Date;
    metadata?: any;
  }) {
    return trace.generation({
      id: `${config.name}-${Date.now()}`,
      name: config.name,
      model: config.model,
      input: config.input,
      output: config.output,
      usage: config.usage,
      startTime: config.startTime,
      endTime: config.endTime,
      metadata: config.metadata
    });
  }

  // Score a generation
  scoreGeneration(generationId: string, scores: {
    name: string;
    value: number;
    comment?: string;
  }[]) {
    scores.forEach(score => {
      this.langfuse.score({
        traceId: generationId,
        name: score.name,
        value: score.value,
        comment: score.comment
      });
    });
  }

  // Flush pending events
  async flush() {
    await this.langfuse.flushAsync();
  }

  // Get Langfuse instance for direct access
  getInstance() {
    return this.langfuse;
  }
}

export const langfuseService = new LangfuseService();