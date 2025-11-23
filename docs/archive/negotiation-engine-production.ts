/**
 * Production-Ready Negotiation Engine (Legacy Snapshot)
 * Integrates OpenAI Agents with Langfuse for structured multi-turn negotiations
 *
 * NOTE: This archive file references the pre-2025 schema (e.g., `negotiation_dimensions`, `negotiation_contexts`). Use only for historical context.
 */

import { Agent, Runner } from 'openai-agents';
import { Langfuse } from 'langfuse';
import { db, negotiations, simulationRuns, agents as agentsTable, negotiationDimensions } from '../storage';
import { eq, and } from 'drizzle-orm';

// Structured output schemas for negotiation responses
export interface NegotiationOffer {
  dimension_values: Record<string, any>;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
}

export interface NegotiationResponse {
  message: string;
  action: 'continue' | 'accept' | 'terminate';
  offer: NegotiationOffer;
  internal_analysis: string;
}

export interface NegotiationConfig {
  negotiationId: string;
  maxRounds: number;
  langfuseConfig: {
    secretKey: string;
    publicKey: string;
    host?: string;
  };
}

export interface NegotiationResult {
  outcome: 'DEAL_ACCEPTED' | 'TERMINATED' | 'MAX_ROUNDS_REACHED';
  totalRounds: number;
  finalOffer?: NegotiationOffer;
  conversationLog: Array<{
    round: number;
    agent: string;
    response: NegotiationResponse;
  }>;
  langfuseTraceId?: string;
}

export class ProductionNegotiationEngine {
  private langfuse: Langfuse;

  constructor(private config: NegotiationConfig) {
    this.langfuse = new Langfuse({
      secretKey: config.langfuseConfig.secretKey,
      publicKey: config.langfuseConfig.publicKey,
      host: config.langfuseConfig.host || 'https://cloud.langfuse.com'
    });
  }

  /**
   * Fetch negotiation data with all related information
   */
  private async fetchNegotiationData() {
    const negotiationData = await db
      .select()
      .from(negotiations)
      .leftJoin(negotiationDimensions, eq(negotiations.id, negotiationDimensions.negotiationId))
      .where(eq(negotiations.id, this.config.negotiationId))
      .limit(1);

    if (!negotiationData.length) {
      throw new Error(`Negotiation not found: ${this.config.negotiationId}`);
    }

    // Get simulation run data for techniques and tactics
    const simulationData = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, this.config.negotiationId))
      .limit(1);

    return {
      negotiation: negotiationData[0].negotiations,
      dimensions: negotiationData.map(row => row.negotiation_dimensions).filter(Boolean),
      simulation: simulationData[0] || null
    };
  }

  /**
   * Get Langfuse template and inject all variables
   */
  private async createAgentInstructions(rolePerspective: 'BUYER' | 'SELLER', data: any): Promise<string> {
    try {
      const langfusePrompt = await this.langfuse.get_prompt('negotiation');
      
      // Extract system message from chat template
      let promptTemplate: string;
      if (Array.isArray(langfusePrompt.prompt)) {
        const systemMessage = langfusePrompt.prompt.find(msg => msg.role === 'system');
        if (!systemMessage) {
          throw new Error('No system message found in Langfuse chat template');
        }
        promptTemplate = systemMessage.content;
      } else {
        promptTemplate = langfusePrompt.prompt;
      }

      // Build ZOPA boundaries from dimensions
      const zopaBoundaries = data.dimensions.map((dim: any) => 
        `${dim.name}: ${dim.minValue} - ${dim.maxValue} ${dim.unit || ''}`
      ).join('\\n');

      // Build dimension priority matrix
      const priorityMatrix = data.dimensions
        .sort((a: any, b: any) => a.priority - b.priority)
        .map((dim: any, index: number) => 
          `${index + 1}. ${dim.name} (Priority ${dim.priority} - ${dim.priority === 1 ? 'Critical' : dim.priority === 2 ? 'Important' : 'Flexible'})`
        ).join('\\n');

      // Comprehensive variable mapping for all 42 template variables
      const variables = {
        // Core role
        'role_perspective': rolePerspective,
        'agent_role': rolePerspective,
        
        // Negotiation context
        'negotiation_title': data.negotiation.title || 'Business Negotiation',
        'negotiation_type': data.negotiation.negotiationType || 'one-shot',
        'relationship_type': data.negotiation.relationshipType || 'first-time',
        'product_description': data.negotiation.productDescription || 'Business transaction',
        'additional_comments': data.negotiation.additionalComments || 'Standard negotiation',
        
        // Personality (from simulation run or defaults)
        'personality_traits': data.simulation?.personalityTraits || 'Openness: 0.7, Conscientiousness: 0.8, Extraversion: 0.6, Agreeableness: 0.5, Neuroticism: 0.3',
        'personality_type_name': data.simulation?.personalityType || 'Strategic Negotiator',
        'personality_type_description': 'Professional, analytical, goal-oriented business negotiator',
        'personality_instructions': 'Be professional, strategic, and data-driven in your approach',
        'personality_characteristics': 'Analytical, persistent, collaborative when beneficial',
        
        // Technique (from simulation run or defaults)
        'technique_name': data.simulation?.techniqueName || 'Anchoring',
        'technique_description': data.simulation?.techniqueDescription || 'Set initial reference point that influences negotiation outcome',
        'technique_aspects': data.simulation?.techniqueAspects || '• Start with strategic position\\n• Justify with credible reasoning\\n• Adjust gradually',
        'technique_examples': data.simulation?.techniqueExamples || 'Opening with strategic position to anchor expectations',
        'technique_psychological_basis': data.simulation?.techniquePsychologicalBasis || 'cognitive biases in initial value assessment',
        'technique_effectiveness_conditions': data.simulation?.techniqueEffectiveness || 'anchor is reasonable and well-justified',
        
        // Tactic (from simulation run or defaults)
        'tactic_name': data.simulation?.tacticName || 'Professional Persuasion',
        'tactic_category': data.simulation?.tacticCategory || 'Collaborative',
        'tactic_description': data.simulation?.tacticDescription || 'Use professional persuasion techniques',
        'tactic_when_to_use': data.simulation?.tacticWhenToUse || 'When building rapport and trust',
        'tactic_key_phrases': data.simulation?.tacticKeyPhrases || 'Let me understand your needs, We can find a solution, This works for both of us',
        'tactic_advantages': data.simulation?.tacticAdvantages || 'Builds trust and rapport',
        'tactic_risks': data.simulation?.tacticRisks || 'May be seen as too accommodating',
        
        // ZOPA and constraints
        'zopa_boundaries': zopaBoundaries,
        'reservation_point': data.dimensions[0]?.minValue || '$10,000',
        'preferred_range': `${data.dimensions[0]?.targetValue || '$12,000'} - ${data.dimensions[0]?.maxValue || '$15,000'}`,
        'concession_strategy': 'Start firm on high-priority dimensions, make strategic concessions on flexible items',
        
        // Role-specific objectives
        'role_objectives': rolePerspective === 'BUYER' ? 
          '• Minimize costs while maximizing value\\n• Secure favorable terms\\n• Build supplier relationship\\n• Ensure quality delivery' :
          '• Maximize revenue and profit margins\\n• Build long-term customer relationships\\n• Showcase value proposition\\n• Secure repeat business',
        
        'primary_success_metric': rolePerspective === 'BUYER' ? 'Total cost within budget' : 'Revenue above target',
        'secondary_success_metrics': rolePerspective === 'BUYER' ? 'Quality, delivery speed, relationship' : 'Customer satisfaction, retention, margin',
        
        // Strategic analysis
        'dimension_priority_matrix': priorityMatrix,
        'market_position': rolePerspective === 'BUYER' ? 'Cost-conscious buyer with alternatives' : 'Value provider with competitive advantages',
        'counterpart_analysis': rolePerspective === 'BUYER' ? 'Seller focused on profit and relationship building' : 'Buyer balancing cost and value considerations',
        'batna_assessment': rolePerspective === 'BUYER' ? 'Alternative suppliers available with different trade-offs' : 'Other customers available with varying requirements'
      };

      // Replace all template variables
      let completeInstructions = promptTemplate;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        completeInstructions = completeInstructions.replace(new RegExp(placeholder, 'g'), String(value));
      }

      // Add structured output requirement
      completeInstructions += `

CRITICAL: You MUST respond with structured JSON matching this exact schema:

{
    "message": "Your professional negotiation message to the counterpart",
    "action": "continue" | "accept" | "terminate",
    "offer": {
        "dimension_values": {"dimension_name": proposed_value, ...},
        "confidence": 0.0-1.0,
        "reasoning": "Brief explanation of your offer logic"
    },
    "internal_analysis": "Your private assessment of negotiation state and strategy"
}

The response will be parsed as structured JSON - do not include markdown formatting or code blocks.`;

      return completeInstructions;
      
    } catch (error) {
      throw new Error(`Failed to create agent instructions: ${error}`);
    }
  }

  /**
   * Run a complete multi-turn negotiation
   */
  async runNegotiation(): Promise<NegotiationResult> {
    const data = await this.fetchNegotiationData();
    
    // Create Langfuse trace
    const trace = this.langfuse.trace({
      name: 'production_negotiation',
      sessionId: `negotiation_${this.config.negotiationId}`,
      metadata: {
        negotiationId: this.config.negotiationId,
        negotiationType: data.negotiation.negotiationType,
        relationshipType: data.negotiation.relationshipType,
        dimensionCount: data.dimensions.length
      }
    });

    try {
      // Create agents with complete Langfuse instructions
      const buyerInstructions = await this.createAgentInstructions('BUYER', data);
      const sellerInstructions = await this.createAgentInstructions('SELLER', data);

      const buyerAgent = new Agent({
        name: 'Production Buyer Agent',
        instructions: buyerInstructions
      });

      const sellerAgent = new Agent({
        name: 'Production Seller Agent',
        instructions: sellerInstructions
      });

      // Initialize session for memory management
      const session = new SQLiteSession(`production_${this.config.negotiationId}`);
      
      // Start negotiation
      let currentMessage = `NEGOTIATION SCENARIO:

The ${data.negotiation.title} negotiation begins.

Context: ${data.negotiation.productDescription}
Relationship: ${data.negotiation.relationshipType} business relationship
Type: ${data.negotiation.negotiationType}

${data.negotiation.additionalComments ? `Additional notes: ${data.negotiation.additionalComments}` : ''}

You are the BUYER. Make your opening move using your complete negotiation strategy.`;

      const conversationLog: NegotiationResult['conversationLog'] = [];
      let outcome: NegotiationResult['outcome'] = 'MAX_ROUNDS_REACHED';
      let finalOffer: NegotiationOffer | undefined;

      for (let round = 1; round <= this.config.maxRounds; round++) {
        const isEvenRound = round % 2 === 0;
        const agent = isEvenRound ? sellerAgent : buyerAgent;
        const role = isEvenRound ? 'SELLER' : 'BUYER';

        // Create span for this round
        const span = trace.span({
          name: `round_${round}_${role.toLowerCase()}`,
          input: { message: currentMessage, round, role },
          metadata: { 
            agent_role: role,
            complete_langfuse_template: true,
            structured_output: true 
          }
        });

        try {
          // Run agent
          const result = await Runner.run(agent, currentMessage, { session });

          // Parse structured response
          let response: NegotiationResponse;
          try {
            if (result.final_output.trim().startsWith('{')) {
              response = JSON.parse(result.final_output.trim());
            } else {
              // Handle markdown code blocks
              const jsonMatch = result.final_output.match(/```(?:json)?\s*(\{.*?\})\s*```/s);
              if (jsonMatch) {
                response = JSON.parse(jsonMatch[1]);
              } else {
                throw new Error('No valid JSON found');
              }
            }
          } catch (parseError) {
            response = {
              message: result.final_output,
              action: 'continue',
              offer: {
                dimension_values: {},
                confidence: 0.5,
                reasoning: 'Response parsing failed'
              },
              internal_analysis: `Parse error: ${parseError}`
            };
          }

          // Update span
          span.update({ output: response });
          
          // Add to conversation log
          conversationLog.push({
            round,
            agent: role,
            response
          });

          // Check end conditions
          if (response.action === 'accept') {
            outcome = 'DEAL_ACCEPTED';
            finalOffer = response.offer;
            break;
          } else if (response.action === 'terminate') {
            outcome = 'TERMINATED';
            break;
          }

          // Prepare next message (CLEAN - only public information)
          if (round < this.config.maxRounds) {
            const nextRole = isEvenRound ? 'BUYER' : 'SELLER';
            const publicMessage = response.message;
            const offerInfo = response.offer?.dimension_values && Object.keys(response.offer.dimension_values).length > 0 
              ? `Their offer: ${JSON.stringify(response.offer.dimension_values)}`
              : 'No specific offer made.';

            currentMessage = `Round ${round + 1} - You are the ${nextRole}.

The ${role} just said: "${publicMessage}"

${offerInfo}

Make your negotiation response using your complete strategy.`;
          }

        } catch (error) {
          span.update({ output: { error: String(error) }, level: 'ERROR' });
          throw error;
        } finally {
          span.end();
        }
      }

      // Update trace with final results
      trace.update({
        output: {
          outcome,
          totalRounds: conversationLog.length,
          finalOffer,
          conversationLength: conversationLog.length
        }
      });

      return {
        outcome,
        totalRounds: conversationLog.length,
        finalOffer,
        conversationLog,
        langfuseTraceId: trace.id
      };

    } catch (error) {
      trace.update({ 
        output: { error: String(error) }, 
        level: 'ERROR' 
      });
      throw error;
    }
  }

  /**
   * Update simulation run with results
   */
  async updateSimulationResults(simulationRunId: string, result: NegotiationResult) {
    const updateData = {
      status: result.outcome === 'DEAL_ACCEPTED' ? 'completed' : 
              result.outcome === 'TERMINATED' ? 'failed' : 'timeout',
      conversationLog: JSON.stringify(result.conversationLog),
      dimensionResults: result.finalOffer ? JSON.stringify(result.finalOffer.dimension_values) : null,
      completedAt: new Date(),
      langfuseTraceId: result.langfuseTraceId
    };

    await db
      .update(simulationRuns)
      .set(updateData)
      .where(eq(simulationRuns.id, simulationRunId));
  }
}

/**
 * Factory function to create and run a production negotiation
 */
export async function runProductionNegotiation(
  negotiationId: string,
  simulationRunId: string,
  options: {
    maxRounds?: number;
    langfuseConfig: {
      secretKey: string;
      publicKey: string;
      host?: string;
    };
  }
): Promise<NegotiationResult> {
  const engine = new ProductionNegotiationEngine({
    negotiationId,
    maxRounds: options.maxRounds || 6,
    langfuseConfig: options.langfuseConfig
  });

  const result = await engine.runNegotiation();
  await engine.updateSimulationResults(simulationRunId, result);
  
  return result;
}
