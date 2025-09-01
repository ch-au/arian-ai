#!/usr/bin/env python3
"""
Production Negotiation Service - Main Entry Point

This is the main script called by Node.js to run OpenAI Agent negotiations.
Now much cleaner and easier to understand thanks to the modular structure.

Usage:
    python run_production_negotiation.py --negotiation-id=123 --simulation-run-id=456

For junior developers:
    1. This file orchestrates the negotiation
    2. Data models are in negotiation_models.py
    3. Helper functions are in negotiation_utils.py
    4. Check README_NEGOTIATION.md for setup instructions
"""

import asyncio
import os
import json
import sys
import argparse
import logging
import time
from typing import Dict, Any, List, Optional

# Configure logging to stderr to avoid interfering with stdout JSON responses
logging.basicConfig(stream=sys.stderr, level=logging.WARNING)

# Apply nest_asyncio for compatibility with existing event loops
import nest_asyncio
nest_asyncio.apply()

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv('.env')

# Import our modular components (handle both direct execution and module imports)
try:
    from negotiation_models import (
        NegotiationConfig, NegotiationOutcome, AgentRole,
        NegotiationResponse, NegotiationOffer
    )
    from negotiation_utils import (
        safe_json_parse, analyze_convergence, format_dimensions_for_prompt,
        generate_dimension_examples, setup_langfuse_tracing, 
        calculate_dynamic_max_rounds, emit_round_update
    )
except ImportError:
    # Handle direct execution from scripts directory
    import sys
    import os
    sys.path.append(os.path.dirname(__file__))
    from negotiation_models import (
        NegotiationConfig, NegotiationOutcome, AgentRole,
        NegotiationResponse, NegotiationOffer
    )
    from negotiation_utils import (
        safe_json_parse, analyze_convergence, format_dimensions_for_prompt,
        generate_dimension_examples, setup_langfuse_tracing, 
        calculate_dynamic_max_rounds, emit_round_update
    )

# Import external dependencies
from agents import Agent, Runner, SQLiteSession
from langfuse import Langfuse


class NegotiationService:
    """
    Main service class that handles the entire negotiation process.
    
    This class breaks down the complex negotiation logic into manageable pieces.
    Each method has a single, clear responsibility.
    """
    
    def __init__(self, args: argparse.Namespace):
        """Initialize the negotiation service with command line arguments."""
        self.args = args
        self.negotiation_data: Optional[Dict[str, Any]] = None
        self.langfuse: Optional[Langfuse] = None
        self.langfuse_prompt = None
        self.trace = None
        
    async def run_negotiation(self) -> Dict[str, Any]:
        """
        Main orchestration method - runs the entire negotiation.
        
        This is the high-level flow that's easy to follow:
        1. Setup and validate environment
        2. Initialize services (Langfuse, etc.)
        3. Create AI agents  
        4. Run negotiation rounds
        5. Return results
        
        Returns:
            Dict with negotiation results or error information
        """
        try:
            # Step 1: Environment validation
            if not self._validate_environment():
                return {"error": "Environment validation failed"}
            
            # Step 2: Parse and validate input data
            if not self._parse_negotiation_data():
                return {"error": "Invalid negotiation data"}
            
            # Step 3: Initialize external services
            if not await self._initialize_services():
                return {"error": "Service initialization failed"}
            
            # Step 4: Create AI agents
            agents = self._create_agents()
            if not agents:
                return {"error": "Agent creation failed"}
            
            # Step 5: Run the actual negotiation
            results = await self._execute_negotiation_rounds(agents)
            
            # Step 6: Finalize and return results
            return self._finalize_results(results)
            
        except Exception as e:
            error_msg = f"Negotiation failed: {str(e)}"
            print(f"ERROR: {error_msg}", file=sys.stderr)
            if self.trace:
                self.trace.update(output={"error": error_msg}, level="ERROR")
            return {"error": error_msg}
    
    def _validate_environment(self) -> bool:
        """Check if all required environment variables are present."""
        is_valid, missing_vars = NegotiationConfig.validate_environment()
        if not is_valid:
            print(f"ERROR: Missing environment variables: {', '.join(missing_vars)}", file=sys.stderr)
            return False
        return True
    
    def _parse_negotiation_data(self) -> bool:
        """Parse and validate the negotiation data JSON."""
        if not self.args.negotiation_data:
            print("DEBUG: No negotiation data provided", file=sys.stderr)
            return True  # Optional data
            
        try:
            self.negotiation_data = json.loads(self.args.negotiation_data)
            print(f"DEBUG: Parsed negotiation data successfully", file=sys.stderr)
            return True
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid negotiation data JSON: {e}", file=sys.stderr)
            return False
    
    async def _initialize_services(self) -> bool:
        """Initialize Langfuse and other external services."""
        try:
            # Setup tracing first
            tracing_enabled = setup_langfuse_tracing()
            print(f"DEBUG: Tracing enabled: {tracing_enabled}", file=sys.stderr)
            
            # Initialize Langfuse client
            self.langfuse = Langfuse(
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                host=os.getenv("LANGFUSE_HOST", NegotiationConfig.LANGFUSE_DEFAULT_HOST),
                debug=False,
                flush_at=1,
                flush_interval=NegotiationConfig.LANGFUSE_FLUSH_INTERVAL,
                max_retries=NegotiationConfig.LANGFUSE_MAX_RETRIES,
                timeout=NegotiationConfig.LANGFUSE_TIMEOUT,
            )
            
            # Get prompt template
            self.langfuse_prompt = self.langfuse.get_prompt("negotiation")
            print(f"DEBUG: Retrieved Langfuse prompt: {self.langfuse_prompt.name} v{self.langfuse_prompt.version}", file=sys.stderr)
            
            # Create trace for monitoring
            self.trace = self._create_langfuse_trace()
            
            return True
            
        except Exception as e:
            print(f"ERROR: Service initialization failed: {e}", file=sys.stderr)
            return False
    
    def _create_langfuse_trace(self):
        """Create a Langfuse trace for monitoring this negotiation."""
        negotiation_title = "Unknown"
        if self.negotiation_data and self.negotiation_data.get('negotiation'):
            negotiation_title = self.negotiation_data['negotiation'].get('title', 'Unknown')
            
        return self.langfuse.trace(
            name="production_microservice_negotiation",
            session_id=f"prod_{self.args.negotiation_id}_{self.args.simulation_run_id}",
            user_id=f"simulation_{self.args.simulation_run_id}",
            metadata={
                "negotiation_id": self.args.negotiation_id,
                "simulation_run_id": self.args.simulation_run_id,
                "negotiation_title": negotiation_title,
                "technique_id": self.args.technique_id,
                "tactic_id": self.args.tactic_id,
                "max_rounds": self.args.max_rounds,
                "microservice": True,
                "langfuse_prompt_name": self.langfuse_prompt.name,
                "langfuse_prompt_version": self.langfuse_prompt.version,
            },
            tags=["production", "openai-agents", "microservice"]
        )
    
    def _create_agents(self) -> Optional[Dict[str, Agent]]:
        """Create buyer and seller AI agents with proper instructions."""
        try:
            # Get model configuration from Langfuse prompt
            model_config = getattr(self.langfuse_prompt, 'config', {})
            model_name = model_config.get('model', NegotiationConfig.DEFAULT_MODEL)
            
            # Fix invalid model names
            if model_name == 'gpt-5-mini':
                model_name = 'gpt-4o-mini'
            
            print(f"DEBUG: Creating agents with model: {model_name}", file=sys.stderr)
            
            # Create instructions for both roles
            buyer_instructions = self._create_agent_instructions(AgentRole.BUYER)
            seller_instructions = self._create_agent_instructions(AgentRole.SELLER)
            
            # Create the agents
            buyer_agent = Agent(
                name="Production Buyer Agent",
                instructions=buyer_instructions,
                model=model_name
            )
            
            seller_agent = Agent(
                name="Production Seller Agent", 
                instructions=seller_instructions,
                model=model_name
            )
            
            return {
                AgentRole.BUYER: buyer_agent,
                AgentRole.SELLER: seller_agent
            }
            
        except Exception as e:
            print(f"ERROR: Agent creation failed: {e}", file=sys.stderr)
            return None
    
    def _create_agent_instructions(self, role: str) -> str:
        """
        Create detailed instructions for an AI agent.
        
        This builds the system prompt that tells the agent how to behave.
        The instructions are customized based on the negotiation data and role.
        
        Args:
            role: Either 'BUYER' or 'SELLER'
            
        Returns:
            Complete system prompt string
        """
        # Extract prompt template
        if isinstance(self.langfuse_prompt.prompt, list):
            system_message = next((msg for msg in self.langfuse_prompt.prompt if msg['role'] == 'system'), None)
            prompt_template = system_message['content'] if system_message else ""
        else:
            prompt_template = self.langfuse_prompt.prompt
        
        # Build variable substitutions
        variables = self._build_prompt_variables(role)
        
        # Replace all template variables
        complete_instructions = prompt_template
        for key, value in variables.items():
            placeholder = '{{' + key + '}}'
            complete_instructions = complete_instructions.replace(placeholder, str(value))
        
        # Add structured output requirements
        complete_instructions += self._get_structured_output_instructions()
        
        return complete_instructions
    
    def _build_prompt_variables(self, role: str) -> Dict[str, str]:
        """Build the variable substitutions for the prompt template."""
        # Extract data with safe defaults
        negotiation = self.negotiation_data.get('negotiation', {}) if self.negotiation_data else {}
        context = self.negotiation_data.get('context', {}) if self.negotiation_data else {}
        technique = self.negotiation_data.get('technique', {}) if self.negotiation_data else {}
        tactic = self.negotiation_data.get('tactic', {}) if self.negotiation_data else {}
        dimensions = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
        
        # Ensure all are proper types
        negotiation = negotiation if isinstance(negotiation, dict) else {}
        context = context if isinstance(context, dict) else {}
        technique = technique if isinstance(technique, dict) else {}
        tactic = tactic if isinstance(tactic, dict) else {}
        dimensions = dimensions if isinstance(dimensions, list) else []
        
        # Generate dimension information
        dimension_examples = generate_dimension_examples(dimensions)
        dimension_details = format_dimensions_for_prompt(dimensions)
        
        return {
            # Role information
            'role_perspective': role,
            'agent_role': role,
            
            # Negotiation context
            'negotiation_title': negotiation.get('title', 'Production Negotiation'),
            'negotiation_type': negotiation.get('negotiationType', 'one-shot'),
            'relationship_type': negotiation.get('relationshipType', 'first-time'),
            'product_description': negotiation.get('productMarketDescription', 'Business transaction'),
            'additional_comments': negotiation.get('additionalComments', 'Production negotiation run'),
            
            # Personality (simplified for now)
            'personality_traits': 'Strategic, professional, goal-oriented',
            'personality_type_name': 'Business Negotiator',
            'personality_instructions': 'Be professional and strategic',
            
            # Technique and tactic information
            'technique_name': technique.get('name', 'Strategic Negotiation'),
            'technique_description': technique.get('description', technique.get('beschreibung', 'Professional negotiation approach')),
            'tactic_name': tactic.get('name', 'Professional Approach'),
            'tactic_description': tactic.get('description', tactic.get('beschreibung', 'Maintain professional standards')),
            
            # Dimensions and boundaries
            'zopa_boundaries': dimension_details,
            'dimension_details': dimension_details,
            'dimension_examples': dimension_examples,
            
            # Role-specific objectives
            'role_objectives': self._get_role_objectives(role),
            'primary_success_metric': self._get_primary_metric(role),
        }
    
    def _get_role_objectives(self, role: str) -> str:
        """Get role-specific objectives."""
        if role == AgentRole.BUYER:
            return "Minimize costs, maximize value, ensure quality and timely delivery"
        else:
            return "Maximize revenue, build relationships, maintain healthy profit margins"
    
    def _get_primary_metric(self, role: str) -> str:
        """Get primary success metric for role."""
        if role == AgentRole.BUYER:
            return "Total cost under budget with acceptable quality"
        else:
            return "Revenue above target with satisfied customer"
    
    def _get_structured_output_instructions(self) -> str:
        """Get the structured output requirements for agents."""
        return """

CRITICAL: You MUST respond with structured JSON matching this exact schema:

{
    "message": "Your professional negotiation message to the counterpart",
    "action": "continue" | "accept" | "terminate" | "walk_away" | "pause",
    "offer": {
        "dimension_values": {<DIMENSIONS_GO_HERE>},
        "confidence": 0.8,
        "reasoning": "Brief explanation of your offer logic"
    },
    "internal_analysis": "Your private assessment of negotiation state and strategy",
    "batna_assessment": 0.7,
    "walk_away_threshold": 0.3
}

ACTIONS EXPLAINED:
- "continue": Keep negotiating (default)
- "accept": Accept the counterpart's latest offer  
- "terminate": End negotiations politely without agreement
- "walk_away": Leave due to unacceptable terms
- "pause": Temporarily pause to consult stakeholders

The response will be parsed as JSON - do not include markdown formatting or code blocks."""
    
    async def _execute_negotiation_rounds(self, agents: Dict[str, Agent]) -> List[Dict[str, Any]]:
        """
        Execute the actual negotiation rounds between agents.
        
        This is where the AI agents actually negotiate back and forth.
        
        Args:
            agents: Dictionary with BUYER and SELLER agents
            
        Returns:
            List of round results
        """
        # Initialize session and conversation
        session = SQLiteSession(f"production_{self.args.simulation_run_id}")
        results = self._load_existing_conversation()
        
        # Calculate dynamic round limit
        dimensions = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
        max_rounds = calculate_dynamic_max_rounds(self.args.max_rounds, dimensions)
        
        print(f"DEBUG: Starting negotiation with max {max_rounds} rounds", file=sys.stderr)
        
        # Initialize first message
        current_message = self._get_starting_message(results)
        final_outcome = NegotiationOutcome.ERROR  # Default
        
        try:
            round_num = len(results)
            while round_num < max_rounds:
                round_num += 1
                
                # Determine which agent's turn it is
                role = AgentRole.BUYER if round_num % 2 == 1 else AgentRole.SELLER
                agent = agents[role]
                
                print(f"DEBUG: Round {round_num} - {role} turn", file=sys.stderr)
                
                # Execute round
                response_data = await self._execute_single_round(
                    agent, role, current_message, round_num, max_rounds
                )
                
                if not response_data:
                    break  # Error occurred
                
                # Store result
                results.append({
                    "round": round_num,
                    "agent": role,
                    "response": response_data
                })
                
                # Emit real-time update
                emit_round_update(round_num, role, response_data)
                
                # Check for termination
                action = response_data.get("action", "continue")
                final_outcome = self._determine_outcome(action, response_data)
                
                if final_outcome != NegotiationOutcome.ERROR:
                    break
                
                # Prepare next round message
                if round_num < max_rounds:
                    current_message = self._prepare_next_message(role, response_data, round_num)
                
                # Check for convergence and possible extension
                if self._should_extend_negotiation(round_num, max_rounds, results):
                    max_rounds = min(round_num + 3, NegotiationConfig.ABSOLUTE_MAX_ROUNDS)
                    print(f"DEBUG: Extending negotiation to {max_rounds} rounds due to convergence", file=sys.stderr)
            
            # Set final outcome if still running
            if final_outcome == NegotiationOutcome.ERROR:
                final_outcome = NegotiationOutcome.MAX_ROUNDS_REACHED
            
            print(f"DEBUG: Negotiation completed with outcome: {final_outcome}", file=sys.stderr)
            
        except Exception as e:
            print(f"ERROR: Negotiation execution failed: {e}", file=sys.stderr)
            final_outcome = NegotiationOutcome.ERROR
        
        # Store final outcome for result processing
        self._final_outcome = final_outcome
        return results
    
    def _load_existing_conversation(self) -> List[Dict[str, Any]]:
        """Load existing conversation if resuming a negotiation."""
        if not self.args.existing_conversation:
            return []
            
        try:
            existing = json.loads(self.args.existing_conversation)
            print(f"DEBUG: Resuming with {len(existing)} existing rounds", file=sys.stderr)
            return existing
        except json.JSONDecodeError as e:
            print(f"WARNING: Failed to parse existing conversation: {e}", file=sys.stderr)
            return []
    
    def _get_starting_message(self, existing_results: List[Dict[str, Any]]) -> str:
        """Get the starting message for the negotiation."""
        if existing_results:
            # Resume from last message
            last_round = existing_results[-1] if existing_results else None
            return last_round.get('response', {}).get('message', 'Können wir unsere Verhandlung fortsetzen?')
        else:
            # Fresh start
            return "Hallo, guten Tag! Ich freue mich auf unsere Verhandlung."
    
    async def _execute_single_round(self, agent: Agent, role: str, message: str, 
                                   round_num: int, max_rounds: int) -> Optional[Dict[str, Any]]:
        """Execute a single negotiation round."""
        span = self.trace.span(
            name=f"round_{round_num}_{role.lower()}_response",
            input={
                "message": message[:200] + "..." if len(message) > 200 else message,
                "round": round_num,
                "agent_role": role
            },
            metadata={
                "agent_role": role,
                "negotiation_round": round_num,
                "total_rounds": max_rounds,
            },
            level="DEFAULT"
        )
        
        try:
            # Execute agent
            start_time = time.time()
            result = await Runner.run(agent, message, session=SQLiteSession(f"production_{self.args.simulation_run_id}"))
            execution_time = time.time() - start_time
            
            # Parse response
            response_data = safe_json_parse(result.final_output)
            
            # Update span with results
            span.update(
                output={
                    "structured_response": response_data,
                    "action_taken": response_data.get('action', 'unknown'),
                    "offer_confidence": response_data.get('offer', {}).get('confidence', 0),
                },
                level="DEFAULT",
                status_message="Round completed successfully"
            )
            
            # Add confidence score
            confidence = response_data.get('offer', {}).get('confidence', 0)
            span.score(name="offer_confidence", value=confidence, comment=f"Agent confidence: {confidence}")
            
            return response_data
            
        except Exception as e:
            print(f"ERROR: Round {round_num} failed: {e}", file=sys.stderr)
            span.update(
                output={"error": str(e)},
                level="ERROR",
                status_message=f"Failed: {str(e)}"
            )
            return None
        finally:
            span.end()
    
    def _determine_outcome(self, action: str, response_data: Dict[str, Any]) -> str:
        """Determine if the negotiation should end based on agent action."""
        if action == "accept":
            return NegotiationOutcome.DEAL_ACCEPTED
        elif action == "terminate":
            return NegotiationOutcome.TERMINATED
        elif action == "walk_away":
            return NegotiationOutcome.WALK_AWAY
        elif action == "pause":
            return NegotiationOutcome.PAUSED
        else:
            # Check BATNA threshold
            batna_score = response_data.get("batna_assessment", 0.5)
            walk_threshold = response_data.get("walk_away_threshold", 0.3)
            
            if batna_score < walk_threshold:
                return NegotiationOutcome.WALK_AWAY
            
            return NegotiationOutcome.ERROR  # Continue negotiating
    
    def _prepare_next_message(self, current_role: str, response_data: Dict[str, Any], round_num: int) -> str:
        """Prepare the message for the next agent."""
        next_role = AgentRole.get_opposite_role(current_role)
        public_message = response_data.get('message', '')
        public_offer = response_data.get('offer', {})
        
        # Build offer text
        if public_offer and public_offer.get('dimension_values'):
            dimension_values = public_offer.get('dimension_values', {})
            offer_text = f"Their offer: {dimension_values}"
        else:
            offer_text = "No specific offer made."
        
        return f"""Round {round_num + 1} - You are the {next_role}.

The {current_role} just said: "{public_message}"

{offer_text}

Make your negotiation response using your complete strategy."""
    
    def _should_extend_negotiation(self, round_num: int, max_rounds: int, results: List[Dict]) -> bool:
        """Check if negotiation should be extended due to convergence."""
        if round_num < max_rounds or len(results) < 2 or round_num >= NegotiationConfig.ABSOLUTE_MAX_ROUNDS:
            return False
        
        # Check convergence
        last_offer = results[-1]["response"].get("offer", {}).get("dimension_values", {})
        prev_offer = results[-2]["response"].get("offer", {}).get("dimension_values", {})
        
        return analyze_convergence(last_offer, prev_offer)
    
    def _finalize_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Finalize and format the negotiation results."""
        final_offer = results[-1]["response"].get("offer") if results else None
        outcome = getattr(self, '_final_outcome', NegotiationOutcome.ERROR)
        success_score = NegotiationOutcome.get_success_score(outcome)
        
        # Update trace with final information
        if self.trace:
            self.trace.update(
                output={
                    "outcome": outcome,
                    "total_rounds": len(results),
                    "final_offer": final_offer,
                    "successful_completion": outcome in [NegotiationOutcome.DEAL_ACCEPTED, NegotiationOutcome.TERMINATED],
                },
                level="DEFAULT",
                status_message=f"Negotiation completed: {outcome}"
            )
            
            self.trace.score(
                name="negotiation_success",
                value=success_score,
                comment=f"Outcome: {outcome}"
            )
            
            # Flush to Langfuse
            try:
                self.langfuse.flush()
                print(f"DEBUG: Trace flushed to Langfuse: {self.trace.get_trace_url()}", file=sys.stderr)
            except Exception as e:
                print(f"WARNING: Trace flush failed: {e}", file=sys.stderr)
        
        return {
            "outcome": outcome,
            "totalRounds": len(results),
            "finalOffer": final_offer,
            "conversationLog": results,
            "langfuseTraceId": self.trace.id if self.trace else None
        }


async def main():
    """Main entry point for the negotiation service."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Run production negotiation')
    parser.add_argument('--negotiation-id', required=True, help='Negotiation ID')
    parser.add_argument('--simulation-run-id', required=True, help='Simulation run ID')
    parser.add_argument('--technique-id', help='Technique ID')
    parser.add_argument('--tactic-id', help='Tactic ID')
    parser.add_argument('--max-rounds', type=int, default=6, help='Maximum rounds')
    parser.add_argument('--negotiation-data', help='JSON string with negotiation data')
    parser.add_argument('--existing-conversation', help='JSON string with existing conversation')
    
    args = parser.parse_args()
    
    # Create and run negotiation service
    service = NegotiationService(args)
    result = await service.run_negotiation()
    
    # Output result as JSON
    print(json.dumps(result))
    
    # Exit with error code if negotiation failed
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
