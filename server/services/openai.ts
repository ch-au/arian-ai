import OpenAI from "openai";
import { PersonalityProfile, Agent, NegotiationContext, ZopaBoundaries } from "@shared/schema";
import { langfuseService } from "./langfuse";
import { storage } from "../storage";
import { createRequestLogger } from "./logger";

const log = createRequestLogger("service:openai");

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});

export interface NegotiationMessage {
  role: 'buyer' | 'seller';
  content: string;
  proposal?: {
    volume?: number;
    price?: number;
    paymentTerms?: number;
    contractDuration?: number;
  };
}

export interface NegotiationResponse {
  message: string;
  proposal?: {
    volume?: number;
    price?: number;
    paymentTerms?: number;
    contractDuration?: number;
  };
  reasoning: string;
  confidence: number;
  tokensUsed: number;
  responseTime: number;
}

export class OpenAINegotiationService {
  private getPersonalityType(personality: PersonalityProfile): string {
    // Determine personality type based on Big Five traits
    if (personality.agreeableness > 0.6 && personality.extraversion > 0.6) {
      return 'collaborative';
    } else if (personality.extraversion > 0.7 && personality.agreeableness < 0.4) {
      return 'aggressive';
    } else if (personality.conscientiousness > 0.7 && personality.openness > 0.6) {
      return 'analytical';
    } else {
      return 'diplomatic';
    }
  }

  private determineZopaSituation(history: NegotiationMessage[], boundaries: ZopaBoundaries): 'within_range' | 'outside_range' | 'near_limits' {
    // Analyze the last proposal to determine ZOPA situation
    const lastMessage = history[history.length - 1];
    if (!lastMessage?.proposal) return 'outside_range';

    const proposal = lastMessage.proposal;
    let withinCount = 0;
    let totalChecks = 0;

    // Check each boundary
    if (boundaries.volume && proposal.volume) {
      totalChecks++;
      if (proposal.volume >= boundaries.volume.minAcceptable && proposal.volume <= boundaries.volume.maxDesired) {
        withinCount++;
      }
    }
    if (boundaries.price && proposal.price) {
      totalChecks++;
      if (proposal.price >= boundaries.price.minAcceptable && proposal.price <= boundaries.price.maxDesired) {
        withinCount++;
      }
    }
    if (boundaries.paymentTerms && proposal.paymentTerms) {
      totalChecks++;
      if (proposal.paymentTerms >= boundaries.paymentTerms.minAcceptable && proposal.paymentTerms <= boundaries.paymentTerms.maxDesired) {
        withinCount++;
      }
    }

    if (totalChecks === 0) return 'outside_range';
    
    const ratio = withinCount / totalChecks;
    if (ratio >= 0.8) return 'within_range';
    if (ratio >= 0.5) return 'near_limits';
    return 'outside_range';
  }

  private generatePersonalityPrompt(personality: PersonalityProfile): string {
    const traits = [];
    
    if (personality.openness > 0.6) traits.push("creative and open to new ideas");
    else if (personality.openness < 0.4) traits.push("traditional and prefer proven approaches");
    
    if (personality.conscientiousness > 0.6) traits.push("detail-oriented and methodical");
    else if (personality.conscientiousness < 0.4) traits.push("flexible and adaptable");
    
    if (personality.extraversion > 0.6) traits.push("assertive and confident");
    else if (personality.extraversion < 0.4) traits.push("reserved and thoughtful");
    
    if (personality.agreeableness > 0.6) traits.push("collaborative and cooperative");
    else if (personality.agreeableness < 0.4) traits.push("competitive and direct");
    
    if (personality.neuroticism > 0.6) traits.push("cautious and risk-averse");
    else if (personality.neuroticism < 0.4) traits.push("calm and stable under pressure");

    return `You have a personality that is ${traits.join(", ")}.`;
  }

  private generateZopaPrompt(boundaries: ZopaBoundaries, role: 'buyer' | 'seller'): string {
    const constraints = [];
    
    if (boundaries.volume) {
      constraints.push(`Volume: ${role === 'buyer' ? 'need at least' : 'can provide up to'} ${boundaries.volume.minAcceptable} units, prefer ${boundaries.volume.maxDesired} units`);
    }
    
    if (boundaries.price) {
      constraints.push(`Price: ${role === 'buyer' ? 'can pay up to' : 'need at least'} $${boundaries.price.minAcceptable}/unit, prefer $${boundaries.price.maxDesired}/unit`);
    }
    
    if (boundaries.paymentTerms) {
      constraints.push(`Payment Terms: ${role === 'buyer' ? 'prefer' : 'can accept up to'} ${boundaries.paymentTerms.maxDesired} days, minimum ${boundaries.paymentTerms.minAcceptable} days`);
    }
    
    if (boundaries.contractDuration) {
      constraints.push(`Contract Duration: prefer ${boundaries.contractDuration.maxDesired} months, minimum ${boundaries.contractDuration.minAcceptable} months`);
    }

    return `Your negotiation boundaries are: ${constraints.join('; ')}. Never agree to terms outside these boundaries.`;
  }

  async generateNegotiationResponse(
    agent: Agent,
    role: 'buyer' | 'seller',
    context: NegotiationContext,
    zopaBoundaries: ZopaBoundaries,
    negotiationHistory: NegotiationMessage[],
    roundNumber: number,
    maxRounds: number,
    negotiationId?: string,
    selectedTechniques?: string[],
    selectedTactics?: string[]
  ): Promise<NegotiationResponse> {
    const startTime = new Date();

    // Create Langfuse trace for this negotiation round
    const trace = negotiationId ? langfuseService.createTrace(
      `${negotiationId}-round-${roundNumber}`,
      {
        agentId: agent.id,
        role,
        roundNumber,
        maxRounds,
        contextType: 'supply_contract'
      }
    ) : null;

    // Get prompts from YAML configuration
    const systemPrompt = langfuseService.getSystemPrompt();
    const personalityType = this.getPersonalityType(agent.personalityProfile as PersonalityProfile);
    const personalityPrompt = langfuseService.getPersonalityPrompt(personalityType, roundNumber === 1 ? 'opening' : 'response');
    const contextPrompt = langfuseService.getContextTemplate('supply_contract');
    
    // Determine ZOPA situation and get appropriate prompt
    const zopaSituation = this.determineZopaSituation(negotiationHistory, zopaBoundaries);
    const zopaPrompt = langfuseService.getZopaPrompt(zopaSituation);
    
    // Generate techniques and tactics guidance
    const techniqueGuidance = await this.generateTechniqueGuidance(selectedTechniques);
    const tacticGuidance = await this.generateTacticGuidance(selectedTactics);

    const fullSystemPrompt = `${systemPrompt}

${personalityPrompt}

${contextPrompt}

Context: You are negotiating for ${JSON.stringify(context.productInfo)}. 
Market conditions: ${JSON.stringify(context.marketConditions || {})}.
Baseline values: ${JSON.stringify(context.baselineValues)}.

${zopaPrompt}

Your specific boundaries: ${this.generateZopaPrompt(zopaBoundaries, role)}

${techniqueGuidance ? `\nInfluencing Techniques to Apply:\n${techniqueGuidance}` : ''}

${tacticGuidance ? `\nNegotiation Tactics to Use:\n${tacticGuidance}` : ''}

Current round: ${roundNumber}/${maxRounds}

Instructions:
1. Stay in character based on your personality traits
2. Never exceed your ZOPA boundaries
3. Be realistic and professional
4. Make concrete proposals with specific numbers
5. Apply the specified influencing techniques and negotiation tactics naturally
6. Respond with a JSON object containing your message, proposal, reasoning, and confidence (0-1)
7. As rounds progress, be more willing to compromise within your boundaries
8. Consider the negotiation history and respond appropriately

Respond with JSON in this exact format:
{
  "message": "Your negotiation message to the other party",
  "proposal": {
    "volume": number or null,
    "price": number or null,
    "paymentTerms": number or null,
    "contractDuration": number or null
  },
  "reasoning": "Brief explanation of your strategy",
  "confidence": number between 0 and 1
}`;

    const conversationHistory = negotiationHistory.map(msg => ({
      role: (msg.role === role ? 'assistant' : 'user') as 'assistant' | 'user',
      content: `${msg.content}${msg.proposal ? `\nProposal: ${JSON.stringify(msg.proposal)}` : ''}`
    }));

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...conversationHistory,
          { role: "user", content: `Please provide your response for round ${roundNumber}.` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000,
      });

      const endTime = new Date();
      const responseTime = endTime.getTime() - startTime.getTime();
      const tokensUsed = response.usage?.total_tokens || 0;
      
      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Log to Langfuse if trace is available
      if (trace) {
        const generation = langfuseService.createGeneration(trace, {
          name: `negotiation-round-${roundNumber}`,
          model: "gpt-4o",
          input: {
            systemPrompt: fullSystemPrompt,
            conversationHistory,
            roundNumber,
            agentId: agent.id,
            role
          },
          output: result,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: tokensUsed
          },
          startTime,
          endTime,
          metadata: {
            personalityType,
            zopaSituation,
            confidence: result.confidence || 0.5
          }
        });

        // Score the generation based on confidence and ZOPA compliance
        langfuseService.scoreGeneration(generation.id, [
          {
            name: "confidence",
            value: result.confidence || 0.5,
            comment: "Agent's confidence in their response"
          },
          {
            name: "zopa_compliance",
            value: zopaSituation === 'within_range' ? 1 : zopaSituation === 'near_limits' ? 0.7 : 0.3,
            comment: `ZOPA situation: ${zopaSituation}`
          }
        ]);
      }
      
      return {
        message: result.message || "I'm ready to negotiate.",
        proposal: result.proposal || undefined,
        reasoning: result.reasoning || "Strategic response",
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        tokensUsed,
        responseTime,
      };
    } catch (error) {
      log.error({ err: error }, "OpenAI API error");
      throw new Error(`Failed to generate negotiation response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeNegotiationOutcome(
    negotiationHistory: NegotiationMessage[],
    finalAgreement: any,
    buyerZopa: ZopaBoundaries,
    sellerZopa: ZopaBoundaries
  ): Promise<{
    successScore: number;
    analysis: string;
    recommendations: string[];
  }> {
    const systemPrompt = `You are an expert negotiation analyst. Analyze the negotiation outcome and provide insights.

Buyer ZOPA: ${JSON.stringify(buyerZopa)}
Seller ZOPA: ${JSON.stringify(sellerZopa)}
Final Agreement: ${JSON.stringify(finalAgreement)}

Negotiation History:
${negotiationHistory.map((msg, i) => `Round ${i + 1} (${msg.role}): ${msg.content}`).join('\n')}

Provide analysis in JSON format:
{
  "successScore": number between 0-100,
  "analysis": "Detailed analysis of the negotiation outcome",
  "recommendations": ["recommendation1", "recommendation2", "..."]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        successScore: Math.max(0, Math.min(100, result.successScore || 50)),
        analysis: result.analysis || "Negotiation completed.",
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      log.error({ err: error }, "OpenAI analysis error");
      return {
        successScore: 50,
        analysis: "Analysis unavailable due to API error.",
        recommendations: ["Review negotiation logs for manual analysis."],
      };
    }
  }

  calculateApiCost(tokensUsed: number): number {
    // GPT-4o pricing (as of the model's release): $0.005 per 1K tokens
    return (tokensUsed / 1000) * 0.005;
  }

  private async generateTechniqueGuidance(techniques?: string[]): Promise<string> {
    if (!techniques || techniques.length === 0) return '';
    
    const techniqueDetails = await Promise.all(
      techniques.map(id => storage.getInfluencingTechnique(id))
    );

    const guidance = techniqueDetails
      .filter(t => t)
      .map(t => `**${t!.name}**: ${t!.anwendung} Key phrases: ${(t!.keyPhrases as string[]).join(", ")}`)
      .join('\n- ');
    
    return `- ${guidance}`;
  }

  private async generateTacticGuidance(tactics?: string[]): Promise<string> {
    if (!tactics || tactics.length === 0) return '';
    
    const tacticDetails = await Promise.all(
      tactics.map(id => storage.getNegotiationTactic(id))
    );

    const guidance = tacticDetails
      .filter(t => t)
      .map(t => `**${t!.name}**: ${t!.anwendung} Key phrases: ${(t!.keyPhrases as string[]).join(", ")}`)
      .join('\n- ');
    
    return `- ${guidance}`;
  }
}

export const openaiService = new OpenAINegotiationService();
