#!/usr/bin/env python3
"""
Production Negotiation Service - Main Entry Point

This is the main script called by Node.js to run AI Agent negotiations.
Uses OpenAI Agents SDK with LiteLLM for multi-provider support (OpenAI, Anthropic, Gemini).

Usage:
    python run_production_negotiation.py --negotiation-id=123 --simulation-run-id=456

For junior developers:
    1. This file orchestrates the negotiation
    2. Data models are in negotiation_models.py
    3. Helper functions are in negotiation_utils.py
    4. Check README.md for setup instructions
"""

import asyncio
import os
import json
import sys
import argparse
import logging
import time
import re
import unicodedata
from textwrap import dedent
from typing import Dict, Any, List, Optional

# CONFIGURATION: Maximum price deviation for opponent's perceived target prices
# This controls how much the opponent's target prices differ from user's targets
# based on counterpartDistance (0-100). Example: 0.30 = max 30% deviation at distance=100
MAX_PRICE_DEVIATION = 0.30

# Configure logging to stderr to avoid interfering with stdout JSON responses
# Log level can be controlled via PYTHON_LOG_LEVEL environment variable
log_level = os.getenv('PYTHON_LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    stream=sys.stderr,
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)

# Create logger for this module
logger = logging.getLogger(__name__)

# Apply nest_asyncio for compatibility with existing event loops
import nest_asyncio
nest_asyncio.apply()

# Load environment variables from .env file
from dotenv import load_dotenv
import os

# Try to load .env from multiple locations (current dir, parent dir, project root)
load_dotenv('.env')  # Current directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))  # Parent directory
load_dotenv()  # Search up directory tree (dotenv default behavior)

# Disable OpenAI Agents debug output that interferes with JSON parsing
os.environ["AGENTS_DEBUG"] = "false"
os.environ["OPENAI_LOG_LEVEL"] = "error"

# Redirect OpenAI Agents trace output to stderr to prevent stdout contamination
import sys
from contextlib import redirect_stdout, redirect_stderr

# Import our modular components (handle both direct execution and module imports)
try:
    from negotiation_models import (
        NegotiationConfig, NegotiationOutcome, AgentRole,
        NegotiationResponse, NegotiationOffer
    )
    from negotiation_utils import (
        analyze_convergence, format_dimensions_for_prompt,
        generate_dimension_examples, generate_dimension_schema, setup_langfuse_tracing,
        calculate_dynamic_max_rounds, emit_round_update, normalize_model_output
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
        analyze_convergence, format_dimensions_for_prompt,
        generate_dimension_examples, generate_dimension_schema, setup_langfuse_tracing,
        calculate_dynamic_max_rounds, emit_round_update, normalize_model_output
    )

# Import external dependencies
from agents import Agent, Runner, SQLiteSession, trace, AgentOutputSchema
from agents.extensions.models.litellm_model import LitellmModel
from langfuse import Langfuse

# Try to import observe decorator, fallback if not available
try:
    from langfuse.decorators import observe
except ImportError:
    # Fallback for older Langfuse versions
    def observe(*args, **kwargs):
        """Fallback decorator when langfuse.decorators not available."""
        def decorator(func):
            return func
        return decorator if args and callable(args[0]) else decorator


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
        self.self_agent_prompt = None
        self.opponent_agent_prompt = None
        self.trace = None
        self.self_agent_prompt_name = getattr(args, 'self_agent_prompt', 'agents/self_agent')
        self.opponent_agent_prompt_name = getattr(args, 'opponent_agent_prompt', 'agents/opponent_agent')
        self.user_role: str = AgentRole.SELLER  # Will be determined from opponent_kind
        self.opponent_role: str = AgentRole.BUYER  # Will be determined from opponent_kind
        
    @observe()
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
            logger.info("=== Starting Negotiation Service ===")

            # Step 1: Environment validation
            if not self._validate_environment():
                logger.error("Environment validation failed")
                return {"error": "Environment validation failed"}

            # Step 2: Parse and validate input data
            if not self._parse_negotiation_data():
                logger.error("Invalid negotiation data")
                return {"error": "Invalid negotiation data"}

            # Step 3: Initialize external services
            logger.info("Initializing services (Langfuse, prompts)")
            if not await self._initialize_services():
                logger.error("Service initialization failed")
                return {"error": "Service initialization failed"}

            # Step 4: Create AI agents
            logger.info("Creating AI agents")
            agents = self._create_agents()
            if not agents:
                logger.error("Agent creation failed")
                return {"error": "Agent creation failed"}

            # Step 5: Run the actual negotiation
            logger.info("Starting negotiation rounds")
            results = await self._execute_negotiation_rounds(agents)

            # Step 6: Finalize and return results
            logger.info("=== Negotiation Complete ===")
            return self._finalize_results(results)
            
        except Exception as e:
            error_msg = f"Negotiation failed: {str(e)}"
            logger.error(f"{error_msg}")
            if self.trace:
                self.trace.update(output={"error": error_msg}, level="ERROR")
            return {"error": error_msg}
    
    def _validate_environment(self) -> bool:
        """Check if all required environment variables are present."""
        is_valid, missing_vars = NegotiationConfig.validate_environment()
        if not is_valid:
            logger.error(f"Missing environment variables: {', '.join(missing_vars)}")
            return False
        return True
    
    def _parse_negotiation_data(self) -> bool:
        """Parse and validate the negotiation data JSON."""
        if not self.args.negotiation_data:
            logger.debug("No negotiation data provided")
            return True  # Optional data

        try:
            self.negotiation_data = json.loads(self.args.negotiation_data)
            negotiation_title = self.negotiation_data.get('negotiation', {}).get('title', 'N/A')
            logger.debug(f"Parsed negotiation: {negotiation_title}")
            return True
        except json.JSONDecodeError as e:
            logger.error(f"Invalid negotiation data JSON: {e}")
            return False

    def _load_prompts(self) -> bool:
        """Load Langfuse prompts for self and opponent agents."""
        if not self.langfuse:
            logger.error("Langfuse client not initialized")
            return False

        try:
            self.self_agent_prompt = self._fetch_prompt(self.self_agent_prompt_name, "self")
            self.opponent_agent_prompt = self._fetch_prompt(self.opponent_agent_prompt_name, "opponent")
            return True
        except Exception as prompt_error:
            logger.error(f"Failed to load configured prompts: {prompt_error}")
            return False

    def _fetch_prompt(
        self,
        prompt_name: str,
        prompt_role_label: str
    ):
        """Fetch prompt and raise if it is missing."""
        prompt = self.langfuse.get_prompt(prompt_name)
        if not prompt:
            raise RuntimeError(f"Prompt '{prompt_name}' returned no data")
        logger.debug(f"Loaded {prompt_role_label} prompt: {prompt.name} v{prompt.version}")
        return prompt

    def _resolve_model_config(self) -> Dict[str, Any]:
        """Pick model configuration from loaded prompts."""
        sources = [self.self_agent_prompt, self.opponent_agent_prompt]
        for prompt in sources:
            if not prompt:
                continue
            config = getattr(prompt, "config", None)
            if isinstance(config, dict) and config.get("model"):
                logger.debug(f"Using model from Langfuse config: {config.get('model')}")
                return config
        env_override = os.getenv("NEGOTIATION_MODEL") or os.getenv("LITELLM_MODEL")
        fallback_model = env_override or "gemini/gemini-flash-lite-latest"
        logger.debug(f"Using fallback model: {fallback_model} (env: {'yes' if env_override else 'no'})")
        return {"model": fallback_model}

    def _is_self_role(self, role: str) -> bool:
        """Check if the given role matches the configured user role."""
        role = (role or "").upper()
        configured = (self.user_role or AgentRole.SELLER).upper()
        return role == configured
    
    async def _initialize_services(self) -> bool:
        """Initialize Langfuse and other external services."""
        try:
            # Setup tracing first
            tracing_enabled = setup_langfuse_tracing()
            logger.debug(f"Langfuse tracing: {'enabled' if tracing_enabled else 'disabled'}")

            # Initialize Langfuse client per integration docs
            self.langfuse = Langfuse()
            try:
                # Optional health check
                if hasattr(self.langfuse, "auth_check") and not self.langfuse.auth_check():
                    logger.warning("Langfuse authentication check failed")
            except Exception as e:
                logger.debug(f"Langfuse auth check error (continuing): {e}")

            if not self._load_prompts():
                return False

            logger.info("Services initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Service initialization failed: {e}")
            return False
    
    
    def _create_agents(self) -> Optional[Dict[str, Agent]]:
        """Create buyer and seller AI agents with proper instructions."""
        try:
            # Get model configuration from Langfuse prompt (respects user's choice)
            model_config = self._resolve_model_config()
            model_name = model_config.get('model', NegotiationConfig.DEFAULT_MODEL)

            # Use LiteLLM for all models (including OpenAI)
            # Configure timeout to prevent hanging on slow LLM responses
            model_obj = LitellmModel(
                model=model_name,
                timeout=NegotiationConfig.LLM_REQUEST_TIMEOUT
            )

            # Gemini has strict schema validation - doesn't accept Dict[str, Any] (empty object)
            # Our NegotiationOffer.dimension_values is Dict[str, Any] which causes Gemini errors
            # Solution: Use JSON mode fallback for Gemini models (still structured, just different validation)
            if "gemini" in model_name.lower():
                logger.debug(f"Using JSON mode for Gemini model: {model_name}")
                output_schema = None  # Will parse JSON response manually
            else:
                logger.debug(f"Using structured output for model: {model_name}")
                output_schema = AgentOutputSchema(NegotiationResponse, strict_json_schema=False)

            # CRITICAL: Determine USER role from opponent's kind
            # The USER always gets the detailed self_agent prompt
            # The OPPONENT always gets the simplified opponent_agent prompt
            #
            # SINGLE SOURCE OF TRUTH: counterpart.kind defines the OPPONENT's role
            # USER role is always the INVERSE of opponent's role

            counterpart = self.negotiation_data.get('counterpart', {}) if self.negotiation_data else {}
            opponent_kind = (counterpart.get('kind') or '').lower()

            # Determine OPPONENT role first (from config)
            if opponent_kind in ('retailer', 'buyer', 'einkäufer', 'händler'):
                opponent_role = AgentRole.BUYER
            elif opponent_kind in ('manufacturer', 'seller', 'verkäufer', 'hersteller'):
                opponent_role = AgentRole.SELLER
            else:
                # Fallback: opponent is buyer, user is seller
                logger.warning(f"⚠ Unknown opponent_kind '{opponent_kind}', defaulting to OPPONENT=BUYER, USER=SELLER")
                opponent_role = AgentRole.BUYER

            # USER role is always the OPPOSITE of opponent role
            user_role = AgentRole.SELLER if opponent_role == AgentRole.BUYER else AgentRole.BUYER

            # Store roles for later use in dynamic updates
            self.user_role = user_role
            self.opponent_role = opponent_role

            logger.info(f"Agent roles: USER={user_role}, OPPONENT={opponent_role} (counterpart={opponent_kind})")
            logger.debug(f"  USER gets self_agent prompt, OPPONENT gets opponent_agent prompt")

            # Create instructions with EXPLICIT prompt type
            # User agent always gets detailed self_agent prompt
            user_instructions = self._create_agent_instructions(user_role, use_self_prompt=True)
            # Opponent agent always gets simplified opponent_agent prompt
            opponent_instructions = self._create_agent_instructions(opponent_role, use_self_prompt=False)

            # Create agents: assign instructions based on which role is user vs opponent
            if user_role == AgentRole.BUYER:
                # User is BUYER → buyer gets detailed prompt, seller gets simplified
                buyer_agent = Agent(
                    name="Production Buyer Agent (USER)",
                    instructions=user_instructions,
                    model=model_obj,
                    output_type=output_schema
                )
                seller_agent = Agent(
                    name="Production Seller Agent (OPPONENT)",
                    instructions=opponent_instructions,
                    model=model_obj,
                    output_type=output_schema
                )
            else:  # user_role == SELLER
                # User is SELLER → seller gets detailed prompt, buyer gets simplified
                buyer_agent = Agent(
                    name="Production Buyer Agent (OPPONENT)",
                    instructions=opponent_instructions,
                    model=model_obj,
                    output_type=output_schema
                )
                seller_agent = Agent(
                    name="Production Seller Agent (USER)",
                    instructions=user_instructions,
                    model=model_obj,
                    output_type=output_schema
                )

            # Debug: Log final agent configuration summary
            logger.debug(f"BUYER agent: {buyer_agent.name} -> {'self_agent' if user_role == AgentRole.BUYER else 'opponent_agent'}")
            logger.debug(f"SELLER agent: {seller_agent.name} -> {'self_agent' if user_role == AgentRole.SELLER else 'opponent_agent'}")

            return {
                AgentRole.BUYER: buyer_agent,
                AgentRole.SELLER: seller_agent
            }

        except Exception as e:
            logger.error(f"Agent creation failed: {e}")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return None

    def _create_agent_instructions(self, role: str, use_self_prompt: bool) -> str:
        """
        Create STATIC instructions for an AI agent (sections 1-6 and 8).
        Dynamic round information (section 7) will be passed per-round.

        Args:
            role: Either 'BUYER' or 'SELLER' - the role this agent will play
            use_self_prompt: True for user agent (detailed), False for opponent (simplified)

        Returns:
            Static system prompt string
        """
        # Build static prompt variables (sections 1-6)
        # Pass use_self_prompt so variables can be adjusted for perspective
        variables = self._build_static_prompt_variables(role, use_self_prompt)

        # Determine which prompt to use based on explicit parameter
        prompt = self.self_agent_prompt if use_self_prompt else self.opponent_agent_prompt
        prompt_type = "self_agent" if use_self_prompt else "opponent_agent"

        if not prompt:
            raise ValueError(f"Required Langfuse prompt not loaded for {prompt_type}")

        # Debug: Log which prompt is being used for this role
        agent_type = "USER" if use_self_prompt else "OPPONENT"
        logger.debug(f"Compiling {role} agent ({agent_type}): {prompt.name} v{prompt.version}")

        # Compile Langfuse prompt with variables
        compiled_prompt = prompt.compile(**variables)

        # Handle different return types from Langfuse
        if isinstance(compiled_prompt, list):
            # If it's a list of messages, extract the text content
            compiled_text = ""
            for msg in compiled_prompt:
                if isinstance(msg, dict) and 'content' in msg:
                    compiled_text += msg['content'] + "\n"
                elif isinstance(msg, str):
                    compiled_text += msg + "\n"
            compiled_prompt = compiled_text.strip()

        return compiled_prompt
    
    def _build_static_prompt_variables(self, role: str, use_self_prompt: bool) -> Dict[str, str]:
        """
        Build STATIC variable substitutions for the agent instructions.

        Args:
            role: The role this agent plays (BUYER or SELLER)
            use_self_prompt: True if this is the user agent, False if opponent
        """
        logger.debug(f"Building static variables: role={role}, use_self_prompt={use_self_prompt}")

        negotiation = self.negotiation_data.get('negotiation', {}) if self.negotiation_data else {}
        context = self.negotiation_data.get('context', {}) if self.negotiation_data else {}
        registration = self.negotiation_data.get('registration', {}) if self.negotiation_data else {}
        market = self.negotiation_data.get('market', {}) if self.negotiation_data else {}
        counterpart = self.negotiation_data.get('counterpart', {}) if self.negotiation_data else {}
        technique = self.negotiation_data.get('technique', {}) if self.negotiation_data else {}
        tactic = self.negotiation_data.get('tactic', {}) if self.negotiation_data else {}
        dimensions = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
        products = self.negotiation_data.get('products', []) if self.negotiation_data else []

        negotiation = negotiation if isinstance(negotiation, dict) else {}
        context = context if isinstance(context, dict) else {}
        registration = registration if isinstance(registration, dict) else {}
        market = market if isinstance(market, dict) else {}
        counterpart = counterpart if isinstance(counterpart, dict) else {}
        technique = technique if isinstance(technique, dict) else {}
        tactic = tactic if isinstance(tactic, dict) else {}
        dimensions = dimensions if isinstance(dimensions, list) else []
        products = products if isinstance(products, list) else []
        metadata = context.get('metadata', {}) if isinstance(context.get('metadata'), dict) else {}

        # CRITICAL: Set perspective based on use_self_prompt
        # - If use_self_prompt=True: You are the USER company, opponent is counterpart
        # - If use_self_prompt=False: You are the COUNTERPART company, opponent is user
        if use_self_prompt:
            # This agent represents the USER
            company_name = self._resolve_company_name(registration, context)
            counterpart_company = counterpart.get('name', 'Unbekannt')
        else:
            # This agent represents the OPPONENT - flip perspective!
            company_name = counterpart.get('name', 'Unbekannt')
            counterpart_company = self._resolve_company_name(registration, context)

        dimension_examples = generate_dimension_examples(dimensions)
        dimension_schema = generate_dimension_schema(dimensions)

        # Build pricing and dimension text for prompts
        # Note: Adjust target prices for opponent based on counterpartDistance
        # (stored in context - negotiations.scenario JSONB)
        pricing_related_text = self._build_pricing_strings(products, role, use_self_prompt, context)
        dimension_related_text = self._format_dimension_related_text(dimensions)
        product_key_fields = self._build_product_key_fields(products)
        beliefs_schema = self._build_beliefs_schema(dimensions)
        negotiation_context = self._summarize_negotiation_context(context, market)

        def _fmt_list_or_str(val):
            if isinstance(val, list):
                return ", ".join([str(v) for v in val])
            if isinstance(val, dict):
                return json.dumps(val, ensure_ascii=False)
            return val or ""

        return {
            # Role + company context (required by both prompts)
            'agent_role': role,
            'company': company_name,  # Uses flipped perspective for opponent
            'role_objectives': self._get_role_objectives(role),

            # Negotiation meta (required by both prompts)
            'negotiation_title': negotiation.get('title', 'Production Negotiation'),
            'negotiation_type': context.get('negotiationType') or registration.get('negotiationType') or 'one-shot',
            'negotiation_frequency': context.get('negotiationFrequency') or registration.get('negotiationFrequency') or 'unbekannt',
            'negotiation_context': negotiation_context,
            'intelligence': self._resolve_market_intel(market, context),

            # Round placeholders (initialized for round 0, overwritten per-round by dynamic vars)
            'current_round': "0",
            'max_rounds': str(self.args.max_rounds),
            'previous_rounds': "Noch keine Runden – Start der Simulation.",
            'current_round_message': "Noch keine Nachricht empfangen.",
            'opponent_last_offer': "{}",
            'self_last_offer': "{}",
            'last_round_beliefs_json': "{}",
            'last_round_intentions': "Noch keine Intentionen – erste Runde.",

            # Counterpart info (required by both prompts, perspective-aware)
            'counterpart_company': counterpart_company,  # Uses flipped perspective for opponent
            'counterpart_known': self._format_bool_flag(metadata.get('counterpartKnown')),
            'company_known': self._format_bool_flag(metadata.get('companyKnown')),
            'counterpart_attitude': counterpart.get('style', 'neutral'),
            'counterpart_distance': self._format_counterpart_distance(context.get('counterpartDistance')),
            'power_balance': str(counterpart.get('powerBalance') or 'unbekannt'),
            'counterpart_description': self._describe_counterpart(counterpart),
            'counterpart_dominance': str(counterpart.get('dominance') or 0),  # Interpersonal Circumplex: -100 (submissive) to +100 (dominant)
            'counterpart_affiliation': str(counterpart.get('affiliation') or 0),  # Interpersonal Circumplex: -100 (hostile) to +100 (friendly)

            # Dynamic analysis (initialized, overwritten by dynamic vars)
            'inferred_preferences': "Noch keine Daten – erste Runde.",
            'observed_behaviour': "Keine Beobachtungen zu diesem Zeitpunkt.",

            # Products & dimensions (required by both prompts)
            'pricing_related_text': pricing_related_text,
            'dimension_related_text': dimension_related_text,
            'dimension_examples': dimension_examples,
            'dimension_schema': dimension_schema,
            'beliefs_schema': beliefs_schema,
            'product_key_fields': product_key_fields,

            # Technique + tactic move library (required by self prompt only, but harmless for opponent)
            'technique_name': technique.get('name', 'Strategische Verhandlung'),
            'technique_description': technique.get('beschreibung', technique.get('description', 'Professional negotiation approach')),
            'technique_application': technique.get('anwendung', technique.get('application', 'Nicht verfügbar')),
            'technique_key_aspects': _fmt_list_or_str(technique.get('wichtigeAspekte')),
            'technique_key_phrases': _fmt_list_or_str(technique.get('keyPhrases')),
            'tactic_name': tactic.get('name', 'Professionelle Taktik'),
            'tactic_description': tactic.get('beschreibung', tactic.get('description', 'Maintain professional standards')),
            'tactic_application': tactic.get('anwendung', tactic.get('application', 'Nicht verfügbar')),
            'tactic_key_aspects': _fmt_list_or_str(tactic.get('wichtigeAspekte')),
            'tactic_key_phrases': _fmt_list_or_str(tactic.get('keyPhrases')),
        }

    def _resolve_company_name(self, registration: Dict[str, Any], context: Dict[str, Any]) -> str:
        company_profile = context.get('companyProfile', {}) if isinstance(context.get('companyProfile'), dict) else {}
        return (
            registration.get('company')
            or registration.get('organization')
            or company_profile.get('company')
            or company_profile.get('organization')
            or "Ihr Unternehmen"
        )

    def _format_bool_flag(self, value: Any) -> str:
        if isinstance(value, str):
            value = value.strip().lower() in ("true", "1", "yes", "ja")
        return "Ja" if value else "Nein"

    def _format_counterpart_distance(self, distance_data: Any) -> str:
        """Format counterpart distance data for prompt display."""
        if not distance_data:
            return "Keine Distanzangaben verfügbar"

        if isinstance(distance_data, dict):
            # Format as readable key-value pairs
            parts = []
            for key, value in distance_data.items():
                parts.append(f"{key}: {value}")
            return ", ".join(parts) if parts else "Keine Distanzangaben"

        return str(distance_data)

    def _safe_json_string(self, value: Any, allow_empty: bool = False) -> str:
        if not value:
            return '{}' if allow_empty else ''
        try:
            dumped = json.dumps(value, ensure_ascii=False)
            if dumped == '{}' and not allow_empty:
                return ''
            return dumped
        except Exception:
            return '{}' if allow_empty else str(value)

    def _describe_counterpart(self, counterpart: Dict[str, Any]) -> str:
        if not counterpart:
            return "Keine Angaben zum Verhandlungspartner."

        # Parse personality dimensions (Interpersonal Circumplex)
        # Handle None values explicitly
        dominance = float(counterpart.get('dominance') or 0)
        affiliation = float(counterpart.get('affiliation') or 0)

        personality_traits = []

        # Dominance axis: -100 (submissive) to +100 (dominant)
        if dominance > 30:
            personality_traits.append("durchsetzungsstark")
        elif dominance < -30:
            personality_traits.append("zurückhaltend")
        else:
            personality_traits.append("ausgeglichen assertiv")

        # Affiliation axis: -100 (hostile) to +100 (friendly)
        if affiliation > 30:
            personality_traits.append("kooperativ")
        elif affiliation < -30:
            personality_traits.append("kompetitiv")
        else:
            personality_traits.append("neutral freundlich")

        parts = [
            counterpart.get('name'),
            counterpart.get('kind'),
            f"Persönlichkeit: {', '.join(personality_traits)}" if personality_traits else None,
            f"Stil: {counterpart.get('style')}" if counterpart.get('style') else None,
            f"Notizen: {counterpart.get('notes')}" if counterpart.get('notes') else None,
        ]
        return " | ".join([p for p in parts if p])

    def _calculate_opponent_target_price(
        self,
        own_target_price: float,
        counterpart_distance_data: Any,
        opponent_role: str,
        max_deviation: float = MAX_PRICE_DEVIATION
    ) -> float:
        """
        Calculate the opponent's perceived target price based on distance.

        For opponent agent (use_self_prompt=False), we adjust the target prices
        to reflect uncertainty and strategic positioning based on counterpartDistance.

        Args:
            own_target_price: The user's real target price
            counterpart_distance_data: Distance data (dict or float), 0-100 scale
            opponent_role: The opponent's role ("BUYER" or "SELLER")
            max_deviation: Maximum price deviation (default 30%)

        Returns:
            Adjusted target price for opponent to see
        """
        # Extract distance value
        if isinstance(counterpart_distance_data, dict):
            # Try to get 'gesamt' or first value (legacy fomat)
            distance = float(counterpart_distance_data.get('gesamt', 0))
            if distance == 0 and counterpart_distance_data:
                # Use first available value
                distance = float(next(iter(counterpart_distance_data.values()), 0))
        else:
            try:
                distance = float(counterpart_distance_data or 0)
            except (ValueError, TypeError):
                distance = 0.0

        logger.info(f"Distance data: {counterpart_distance_data}, distance: {distance}")

        # Clamp distance to 0-100
        distance = max(0.0, min(distance, 100.0))

        # Calculate deviation factor: 0 at distance=0, max_deviation at distance=100
        deviation_factor = (distance / 100.0) * max_deviation

        # Apply deviation based on opponent's role
        if opponent_role.upper() == "BUYER":
            # Opponent is buyer → wants lower prices → adjust target DOWN
            adjusted_price = own_target_price * (1 - deviation_factor)
        elif opponent_role.upper() == "SELLER":
            # Opponent is seller → wants higher prices → adjust target UP
            adjusted_price = own_target_price * (1 + deviation_factor)
        else:
            logger.warning(f"Unknown opponent_role '{opponent_role}', using own_target_price")
            adjusted_price = own_target_price

        logger.debug(f"Price adjusted: {own_target_price:.2f} → {adjusted_price:.2f} "
                    f"(dist={distance:.0f}, dev={deviation_factor:.1%}, {opponent_role})")

        return adjusted_price

    def _build_pricing_strings(
        self,
        products: List[Dict[str, Any]],
        role: str,
        use_self_prompt: bool = True,
        context: Dict[str, Any] = None
    ) -> Dict[str, str]:
        if not products:
            return {
                'names': "Keine Produkte definiert.",
                'zielpreise': "Keine Zielpreise vorhanden.",
                'preisgrenzen': "Keine Preisgrenzen vorhanden.",
                'volumes': "Keine Volumenangaben vorhanden.",
            }

        name_lines = []
        ziel_lines = []
        max_lines = []
        volume_lines = []
        guardrails_withheld = True

        for product in products:
            name = self._extract_product_name(product)
            target_price = self._extract_product_field(product, ['zielPreis', 'targetPrice', 'priceTarget'])
            min_price = self._extract_product_field(product, ['minPreis', 'minPrice', 'priceFloor'])
            max_price = self._extract_product_field(product, ['maxPreis', 'maxPrice', 'priceCeiling', 'minMaxPreis'])
            est_volume = self._extract_product_field(product, ['geschätztesVolumen', 'estimatedVolume', 'volume'])

            # For opponent agent, adjust target price based on distance
            # counterpartDistance is stored in context (negotiations.scenario JSONB), not in counterpart table
            if not use_self_prompt and target_price and context:
                distance_data = context.get('counterpartDistance')
                if distance_data:
                    adjusted_target = self._calculate_opponent_target_price(
                        own_target_price=float(target_price),
                        counterpart_distance_data=distance_data,
                        opponent_role=role
                    )
                    target_price = adjusted_target

            name_lines.append(f"- {name}")
            ziel_lines.append(f"- {name}: Zielpreis {self._format_price(target_price)}")
            if use_self_prompt:
                if role == AgentRole.BUYER:
                    max_lines.append(f"- {name}: Maximalpreis {self._format_price(max_price or target_price)}")
                else:
                    max_lines.append(f"- {name}: Minimalpreis {self._format_price(min_price or target_price)}")
            else:
                guardrails_withheld = True
            volume_lines.append(f"- {name}: Erwartetes Volumen {self._format_number(est_volume)} Einheiten")

        if not use_self_prompt and guardrails_withheld:
            maxpreise_text = "Keine Min/Max-Werte verfügbar"
        else:
            maxpreise_text = "\n".join(max_lines) if max_lines else "Keine Preisgrenzen vorhanden."

        return {
            'names': "\n".join(name_lines),
            'zielpreise': "\n".join(ziel_lines),
            'preisgrenzen': maxpreise_text,
            'volumes': "\n".join(volume_lines),
        }

    def _format_pricing_related_text(
        self,
        products: List[Dict[str, Any]],
        role: str,
        use_self_prompt: bool = True,
        counterpart: Dict[str, Any] = None,
        context: Dict[str, Any] = None
    ) -> str:
        if not products:
            return "Keine Produkte definiert."

        blocks = []
        for index, product in enumerate(products):
            name = self._extract_product_name(product) or f"Produkt {index + 1}"
            product_key = product.get("product_key") or self._slugify_product_key(name)
            target_price = self._extract_product_field(product, ['zielPreis', 'targetPrice', 'priceTarget'])
            min_price = self._extract_product_field(product, ['minPreis', 'minPrice', 'priceFloor'])
            max_price = self._extract_product_field(product, ['maxPreis', 'maxPrice', 'priceCeiling', 'minMaxPreis'])
            est_volume = self._extract_product_field(product, ['geschätztesVolumen', 'estimatedVolume', 'volume'])

            # For opponent agent, adjust target price based on distance
            # counterpartDistance is stored in context (negotiations.scenario JSONB), not in counterpart table
            if not use_self_prompt and target_price and context:
                distance_data = context.get('counterpartDistance')
                if distance_data:
                    adjusted_target = self._calculate_opponent_target_price(
                        own_target_price=float(target_price),
                        counterpart_distance_data=distance_data,
                        opponent_role=role
                    )
                    target_price = adjusted_target

            price_guard = (
                self._format_price(max_price or target_price)
                if role == AgentRole.BUYER
                else self._format_price(min_price or target_price)
            )

            price_label = "Max" if role == AgentRole.BUYER else "Min"

            blocks.append(
                "\n".join(
                    [
                        f"- Produkt: {name}",
                        f"  • product_key: {product_key}",
                        f"  • Zielpreis: {self._format_price(target_price)}",
                        f"  • {price_label}: {price_guard}",
                        f"  • Volumen: {self._format_number(est_volume)} Einheiten",
                    ],
                ),
            )

        return "\n".join(blocks)

    def _format_dimension_related_text(self, dimensions: List[Dict[str, Any]]) -> str:
        if not dimensions:
            return "Keine Zusatzdimensionen definiert."

        blocks = []
        for index, dim in enumerate(dimensions):
            name = dim.get("name") or f"Dimension {index + 1}"
            unit = dim.get("unit") or "-"
            priority = dim.get("priority") or "3"
            min_value = dim.get("minValue")
            max_value = dim.get("maxValue")
            target_value = dim.get("targetValue")

            blocks.append(
                "\n".join(
                    [
                        f"- Dimension: {name} (Priorität {priority})",
                        f"  • Einheit: {unit}",
                        f"  • Min: {self._format_number(min_value)}",
                        f"  • Max: {self._format_number(max_value)}",
                        f"  • Ziel: {self._format_number(target_value)}",
                    ],
                ),
            )

        return "\n".join(blocks)

    def _build_product_key_fields(self, products: List[Dict[str, Any]]) -> str:
        if not products:
            return ""

        entries: List[str] = []
        for index, product in enumerate(products):
            name = self._extract_product_name(product) or f"Produkt {index + 1}"
            product_key = product.get("product_key") or self._slugify_product_key(name)
            entries.append(f"\"{product_key}\": <Preis in EUR>")

        return ",\n      ".join(entries)

    def _slugify_product_key(self, value: str) -> str:
        normalized = value.lower()
        # Manually handle German umlauts and sharp s before normalization
        replacements = {
            'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'
        }
        for char, repl in replacements.items():
            normalized = normalized.replace(char, repl)
            
        normalized = unicodedata.normalize("NFD", normalized)
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        normalized = re.sub(r"[^a-z0-9\\s_-]", "", normalized)
        normalized = re.sub(r"[\\s_-]+", "_", normalized)
        return normalized.strip("_")

    def _build_dimension_strings(self, dimensions: List[Dict[str, Any]]) -> Dict[str, str]:
        if not dimensions:
            return {
                'names': "Keine Dimensionen definiert.",
                'units': "",
                'mins': "",
                'maxs': "",
                'targets': "",
                'priorities': "",
            }

        names = []
        units = []
        mins = []
        maxs = []
        targets = []
        priorities = []

        for dim in dimensions:
            name = dim.get('name', 'Dimension')
            names.append(f"- {name}")
            units.append(f"- {name}: Einheit {dim.get('unit', '') or '–'}")
            mins.append(f"- {name}: Minimum {dim.get('minValue', dim.get('min', '–'))}")
            maxs.append(f"- {name}: Maximum {dim.get('maxValue', dim.get('max', '–'))}")
            targets.append(f"- {name}: Ziel {dim.get('targetValue', '–')}")
            priorities.append(
                f"- {name}: Priorität {dim.get('priority', 3)} ({self._priority_label(dim.get('priority', 3))})"
            )

        return {
            'names': "\n".join(names),
            'units': "\n".join(units),
            'mins': "\n".join(mins),
            'maxs': "\n".join(maxs),
            'targets': "\n".join(targets),
            'priorities': "\n".join(priorities),
        }

    def _priority_label(self, value: Any) -> str:
        mapping = {
            1: "kritisch",
            2: "wichtig",
            3: "flexibel",
        }
        try:
            key = int(value)
        except Exception:
            key = 3
        return mapping.get(key, "flexibel")

    def _build_beliefs_schema(self, dimensions: List[Dict[str, Any]]) -> str:
        try:
            dim_template = {dim.get('name', f"Dimension_{idx+1}"): "unknown" for idx, dim in enumerate(dimensions)}
            schema = {
                "opponent_priorities_inferred": dim_template,
                "opponent_emotional_state": "neutral|cooperative|frustriert",
                "opponent_urgency": "low|medium|high",
                "market_signals": {},
                "risk_flags": [],
            }
            return json.dumps(schema, ensure_ascii=False)
        except Exception:
            return '{"opponent_priorities_inferred": {}, "opponent_emotional_state": "neutral"}'

    def _resolve_market_intel(self, market: Dict[str, Any], context: Dict[str, Any]) -> str:
        meta = market.get('meta') if isinstance(market.get('meta'), dict) else {}
        scenario_market = context.get('market', {}) if isinstance(context.get('market'), dict) else {}
        for candidate in [
            meta.get('analysis'),
            meta.get('intelligence'),
            scenario_market.get('intelligence'),
            scenario_market.get('notes'),
        ]:
            if candidate:
                return str(candidate)
        return "Keine Marktdaten verfügbar."

    def _summarize_negotiation_context(self, context: Dict[str, Any], market: Dict[str, Any]) -> str:
        summary = []
        if context.get('relationshipType'):
            summary.append(f"Beziehung: {context.get('relationshipType')}")
        if context.get('negotiationType'):
            summary.append(f"Verhandlungstyp: {context.get('negotiationType')}")
        if context.get('negotiationFrequency'):
            summary.append(f"Frequenz: {context.get('negotiationFrequency')}")
        # Get negotiation description from self.negotiation_data if available
        if self.negotiation_data and self.negotiation_data.get('negotiation', {}).get('description'):
            summary.append(f"Hinweise: {self.negotiation_data['negotiation']['description']}")
        if market.get('name'):
            summary.append(f"Markt: {market.get('name')} ({market.get('countryCode', '')})")
        return "\n".join(summary) if summary else "Keine zusätzlichen Kontextinformationen."

    def _extract_product_name(self, product: Dict[str, Any]) -> str:
        attrs = product.get('attrs') if isinstance(product.get('attrs'), dict) else {}
        return (
            product.get('name')
            or attrs.get('name')
            or product.get('produktName')
            or "Unbekanntes Produkt"
        )

    def _extract_product_field(self, product: Dict[str, Any], keys: List[str], fallback: Any = None) -> Any:
        attrs = product.get('attrs') if isinstance(product.get('attrs'), dict) else {}
        for key in keys:
            if key in product and product[key] not in (None, ''):
                return product[key]
            if attrs and key in attrs and attrs[key] not in (None, ''):
                return attrs[key]
        return fallback

    def _format_price(self, value: Any) -> str:
        try:
            if value is None:
                return "–"
            numeric = float(value)
            return f"€{numeric:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return str(value) if value is not None else "–"

    def _format_number(self, value: Any) -> str:
        try:
            return f"{float(value):,.0f}".replace(",", ".")
        except Exception:
            return str(value) if value is not None else "–"
    
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

    def _format_products_for_prompt(
        self,
        products: List[Dict],
        role: str,
        use_self_prompt: bool = True,
        counterpart: Dict[str, Any] = None,
        context: Dict[str, Any] = None
    ) -> str:
        """Format product information for the negotiation prompt."""
        if not products or len(products) == 0:
            return "Keine spezifischen Produkte definiert."

        product_lines = []
        for product in products:
            name = self._extract_product_name(product)
            ziel_preis = self._extract_product_field(product, ['zielPreis', 'targetPrice', 'priceTarget'])
            min_price = self._extract_product_field(product, ['minPreis', 'minPrice', 'priceFloor'])
            max_price = self._extract_product_field(product, ['maxPreis', 'maxPrice', 'priceCeiling', 'minMaxPreis'])
            volumen = self._extract_product_field(product, ['geschätztesVolumen', 'estimatedVolume', 'volume'])

            # For opponent agent, adjust target price based on distance
            # counterpartDistance is stored in context (negotiations.scenario JSONB)
            if not use_self_prompt and ziel_preis and context:
                distance_data = context.get('counterpartDistance')
                if distance_data:
                    adjusted_target = self._calculate_opponent_target_price(
                        own_target_price=float(ziel_preis),
                        counterpart_distance_data=distance_data,
                        opponent_role=role
                    )
                    ziel_preis = adjusted_target

            if role == AgentRole.BUYER:
                product_lines.append(
                    f"- {name}: Zielpreis {self._format_price(ziel_preis)}, "
                    f"Maximalpreis {self._format_price(max_price or ziel_preis)}, "
                    f"Geschätztes Volumen: {self._format_number(volumen)} Einheiten"
                )
            else:  # SELLER
                product_lines.append(
                    f"- {name}: Zielpreis {self._format_price(ziel_preis)}, "
                    f"Minimalpreis {self._format_price(min_price or ziel_preis)}, "
                    f"Geschätztes Volumen: {self._format_number(volumen)} Einheiten"
                )

        return "\n".join(product_lines)

    def _build_round_message(self, role: str, round_num: int) -> str:
        """
        Build the user message for the current turn.
        
        We no longer inject prior conversation snippets here – the full
        dialogue already lives in the SQLite session and through dynamic
        prompt variables. The round message simply reminds the agent of
        their role and that this exchange requires a counterproposal.
        """
        role_label = "Käufer" if role == AgentRole.BUYER else "Verkäufer"
        return (
            f"Sie sind als {role_label} nun in Runde {round_num}. "
            "Reagieren Sie auf das Angebot der Gegenseite mit einem neuen Vorschlag. "
            "Eine Runde entspricht genau einem Austausch beider Parteien."
        )

    def _build_dynamic_prompt_variables(self, role: str, results: List[Dict[str, Any]], exchange_num: int) -> Dict[str, str]:
        """
        Build DYNAMIC variables that change each round.
        These override the static placeholders from _build_static_prompt_variables.
        
        CRITICAL: Perspective is role-aware:
        - For USER role (self_agent): opponent = the counterpart agent
        - For OPPONENT role (opponent_agent): opponent = the user agent
        """
        # Get agent's own previous round data (this agent's history)
        my_rounds = [r for r in results if r.get("agent") == role]

        # Extract last beliefs/intentions/offer from THIS agent's BDI state
        if my_rounds:
            last_response = my_rounds[-1].get("response", {})
            bdi_state = last_response.get("bdi_state", {})
            last_beliefs = bdi_state.get("beliefs", {})
            last_intentions = bdi_state.get("intentions", "")
            my_last_offer = last_response.get("offer", {}).get("dimension_values", {})
        else:
            last_beliefs = {}
            last_intentions = "Noch keine Intentionen – erste Runde."
            my_last_offer = {}

        # Build conversation history (summary of all rounds)
        conversation_history = self._format_conversation_history(results)

        # Get OPPONENT's last offer and message (the other agent)
        # CRITICAL: opponent is always the OTHER agent, regardless of perspective
        opponent_rounds = [r for r in results if r.get("agent") != role]
        if opponent_rounds:
            opponent_last = opponent_rounds[-1].get("response", {})
            opponent_msg = opponent_last.get("message", "")
            opponent_offer = opponent_last.get("offer", {}).get("dimension_values", {})
        else:
            opponent_msg = "Noch keine Nachricht empfangen."
            opponent_offer = {}

        # Extract inferred preferences from THIS agent's beliefs about the opponent
        inferred_preferences = self._extract_inferred_preferences(last_beliefs)
        # Extract observed behavior of the OPPONENT
        observed_behaviour = self._extract_observed_behavior(opponent_rounds)

        logger.debug(f"Dynamic vars for {role}: opponent_msg={len(opponent_msg)} chars, "
                    f"opponent_offer_keys={list(opponent_offer.keys()) if opponent_offer else []}, "
                    f"my_last_offer_keys={list(my_last_offer.keys()) if my_last_offer else []}")

        return {
            'current_round': str(exchange_num),
            'max_rounds': str(self.args.max_rounds),
            'previous_rounds': conversation_history,
            'current_round_message': opponent_msg,  # Opponent's last message
            'opponent_last_offer': json.dumps(opponent_offer, ensure_ascii=False),  # Opponent's last offer
            'self_last_offer': json.dumps(my_last_offer, ensure_ascii=False),  # This agent's last offer
            'last_round_beliefs_json': json.dumps(last_beliefs, ensure_ascii=False),  # This agent's beliefs
            'last_round_intentions': last_intentions,  # This agent's intentions
            'inferred_preferences': inferred_preferences,  # This agent's inferences about opponent
            'observed_behaviour': observed_behaviour,  # This agent's observations of opponent
        }

    def _format_conversation_history(self, results: List[Dict[str, Any]]) -> str:
        """
        Format conversation history summary.

        NOTE: Full conversation history is already managed by SQLiteSession.
        This method only provides a SUMMARY for the system prompt, not the full history.
        We don't need to duplicate the entire conversation - the Agent SDK handles that.
        """
        if not results:
            return "Noch keine Runden – Start der Simulation."

        # Only provide a SUMMARY, not full history (to avoid duplication with session)
        total_rounds = len(results)

        # Get last 2 rounds for recent context (not all rounds!)
        recent_rounds = results[-2:] if len(results) >= 2 else results

        summary_lines = [f"Bisherige Runden: {total_rounds}"]
        summary_lines.append("\nLetzte Runden (für Kontext):")

        for r in recent_rounds:
            round_num = r.get("round", 0)
            turn_index = r.get("turn")
            agent_role = r.get("agent", "")
            response = r.get("response", {})
            action = response.get("action", "continue")

            turn_suffix = f" (Zug {turn_index})" if turn_index else ""
            summary_lines.append(f"Runde {round_num}{turn_suffix} - {agent_role}: Aktion={action}")

        summary_lines.append("\n(Vollständige Gesprächshistorie ist im Session-Kontext verfügbar)")

        return "\n".join(summary_lines)

    def _extract_inferred_preferences(self, beliefs: Dict[str, Any]) -> str:
        """Extract opponent preferences from belief state."""
        if not beliefs:
            return "Noch keine Daten – erste Runde."

        opponent_prefs = beliefs.get("opponent_priorities_inferred", {})
        if not opponent_prefs:
            return "Noch keine Präferenzen inferiert."

        # Format as readable text
        prefs_text = []
        for dim, priority in opponent_prefs.items():
            prefs_text.append(f"- {dim}: {priority}")

        return "\n".join(prefs_text) if prefs_text else "Noch keine Präferenzen inferiert."

    def _extract_observed_behavior(self, opponent_rounds: List[Dict[str, Any]]) -> str:
        """Extract observed negotiation behavior from opponent's actions."""
        if not opponent_rounds:
            return "Keine Beobachtungen zu diesem Zeitpunkt."

        # Analyze recent opponent actions
        recent_actions = [r.get("response", {}).get("action", "") for r in opponent_rounds[-3:]]

        # Analyze concession patterns
        if len(opponent_rounds) >= 2:
            last_offer = opponent_rounds[-1].get("response", {}).get("offer", {}).get("dimension_values", {})
            prev_offer = opponent_rounds[-2].get("response", {}).get("offer", {}).get("dimension_values", {})

            if last_offer and prev_offer:
                # Check if making concessions
                concessions = []
                for key in last_offer:
                    if key in prev_offer:
                        try:
                            last_val = float(last_offer[key])
                            prev_val = float(prev_offer[key])
                            if last_val != prev_val:
                                concessions.append(f"{key}: {prev_val} → {last_val}")
                        except (ValueError, TypeError):
                            pass

                if concessions:
                    return f"Konzessionen beobachtet: {', '.join(concessions)}"
                else:
                    return "Gegenseite hält an Position fest."

        return f"Letzte Aktionen: {', '.join(recent_actions) if recent_actions else 'keine'}"

    def _update_agent_instructions(self, role: str, dynamic_vars: Dict[str, str]) -> str:
        """
        Recompile agent instructions with dynamic variables.
        Merges static variables with dynamic round-specific updates.
        """
        # Determine if this role uses self_agent or opponent_agent prompt
        use_self_prompt = (role == self.user_role)

        # Get static variables with correct perspective
        static_vars = self._build_static_prompt_variables(role, use_self_prompt)

        # Override with dynamic variables
        merged_vars = {**static_vars, **dynamic_vars}

        # Get the appropriate prompt
        prompt = self.self_agent_prompt if use_self_prompt else self.opponent_agent_prompt
        prompt_type = "self_agent" if use_self_prompt else "opponent_agent"

        if not prompt:
            raise ValueError(f"Required Langfuse prompt not loaded for {prompt_type}")

        logger.debug(f"Updated {role} instructions (round {dynamic_vars.get('current_round')})")

        # Compile with merged variables
        compiled_prompt = prompt.compile(**merged_vars)

        # Handle different return types from Langfuse
        if isinstance(compiled_prompt, list):
            compiled_text = ""
            for msg in compiled_prompt:
                if isinstance(msg, dict) and 'content' in msg:
                    compiled_text += msg['content'] + "\n"
                elif isinstance(msg, str):
                    compiled_text += msg + "\n"
            compiled_prompt = compiled_text.strip()

        return compiled_prompt


    @observe()
    async def _execute_negotiation_rounds(self, agents: Dict[str, Agent]) -> List[Dict[str, Any]]:
        """
        Execute the actual negotiation rounds between agents.
        
        This is where the AI agents actually negotiate back and forth.
        
        Args:
            agents: Dictionary with BUYER and SELLER agents
            
        Returns:
            List of round results
        """
        # Get negotiation title for trace name
        negotiation_title = "Unknown"
        if self.negotiation_data and self.negotiation_data.get('negotiation'):
            negotiation_title = self.negotiation_data['negotiation'].get('title', 'Unknown')

        # Use trace context manager from agents library
        with trace(
            workflow_name=f"production_negotiation_{negotiation_title}",
            metadata={
                "negotiation_id": str(self.args.negotiation_id),
                "simulation_run_id": str(self.args.simulation_run_id),
                "negotiation_title": str(negotiation_title),
                "technique_id": str(self.args.technique_id) if self.args.technique_id else None,
                "tactic_id": str(self.args.tactic_id) if self.args.tactic_id else None,
                "max_rounds": str(self.args.max_rounds),
                "microservice": "true",
                "langfuse_self_prompt_name": str(self.self_agent_prompt.name) if self.self_agent_prompt else None,
                "langfuse_self_prompt_version": str(self.self_agent_prompt.version) if self.self_agent_prompt else None,
                "langfuse_opponent_prompt_name": str(self.opponent_agent_prompt.name) if self.opponent_agent_prompt else None,
                "langfuse_opponent_prompt_version": str(self.opponent_agent_prompt.version) if self.opponent_agent_prompt else None,
            }
        ) as current_trace:
            # Store trace ID for later use
            self._trace_id = current_trace.trace_id

            # Initialize persistent session for the entire negotiation
            # Session automatically tracks conversation history across rounds
            session_id = f"production_{self.args.simulation_run_id}"
            session = None
            results = self._load_existing_conversation()
            self._normalize_round_metadata(results)

            # Use configured max rounds directly (no dynamic calculation)
            max_rounds = self.args.max_rounds
            logger.info(f"Max rounds: {max_rounds}, Session: {session_id}")

            # Build per-round messages dynamically based on latest state
            final_outcome = NegotiationOutcome.ERROR  # Default

            try:
                # Create session with proper resource management
                session = SQLiteSession(session_id)
                turn_index = len(results)
                while turn_index < max_rounds * 2:
                    exchange_num = (turn_index // 2) + 1

                    # Determine which agent's turn it is
                    # IMPORTANT: USER always starts the negotiation
                    if turn_index % 2 == 0:
                        role = self.user_role  # First turn (and every even index) = user
                    else:
                        role = self.opponent_role  # Second turn in the exchange = opponent

                    agent = agents[role]
                    agent_type = 'USER' if role == self.user_role else 'OPPONENT'

                    logger.info(
                        f"Round {exchange_num}/{max_rounds} (turn {turn_index + 1}): "
                        f"{role} ({agent_type}) turn"
                    )

                    # Build dynamic per-round message (Section 7)
                    round_message = self._build_round_message(role, exchange_num)

                    # Execute round with persistent session (pass results for dynamic prompt update)
                    response_data = await self._execute_single_round(
                        agent, role, round_message, exchange_num, max_rounds, session, results
                    )

                    if not response_data:
                        logger.error(f"Round {exchange_num} failed - aborting negotiation")
                        break  # Error occurred

                    # Store result
                    results.append({
                        "round": exchange_num,
                        "turn": turn_index + 1,
                        "agent": role,
                        "response": response_data
                    })
                    turn_index += 1

                    # Emit real-time update
                    emit_round_update(exchange_num, role, response_data)

                    # Check for termination
                    action = response_data.get("action", "continue")
                    final_outcome = self._determine_outcome(action, response_data)

                    if final_outcome != NegotiationOutcome.ERROR:
                        logger.info(f"Negotiation ended: {final_outcome} (action={action})")
                        break

                    # Check for convergence and possible extension
                    if self._should_extend_negotiation(exchange_num, max_rounds, results):
                        max_rounds = min(exchange_num + 3, NegotiationConfig.ABSOLUTE_MAX_ROUNDS)
                        logger.info(f"Extending to {max_rounds} rounds (convergence detected)")

                # Set final outcome if still running
                if final_outcome == NegotiationOutcome.ERROR:
                    final_outcome = NegotiationOutcome.MAX_ROUNDS_REACHED

                total_rounds_played = self._calculate_total_rounds(results)
                logger.info(f"Outcome: {final_outcome}, Total rounds: {total_rounds_played}")

            except Exception as e:
                logger.error(f"Negotiation execution failed: {e}")
                final_outcome = NegotiationOutcome.ERROR

            finally:
                # Clean up session resources
                if session:
                    try:
                        # Close session if it has a close method
                        if hasattr(session, 'close'):
                            session.close()
                            logger.debug(f"Closed session: {session_id}")
                    except Exception as e:
                        logger.warning(f"Failed to close session: {e}")

            # Store final outcome for result processing
            self._final_outcome = final_outcome

            # Update Langfuse trace with input and output data while in trace context
            try:
                negotiation_title = "Unknown"
                if self.negotiation_data and self.negotiation_data.get('negotiation'):
                    negotiation_title = self.negotiation_data['negotiation'].get('title', 'Unknown')

                trace_input = {
                    "negotiation_title": negotiation_title,
                    "negotiation_id": self.args.negotiation_id,
                    "simulation_run_id": self.args.simulation_run_id,
                    "technique_id": self.args.technique_id,
                    "tactic_id": self.args.tactic_id,
                    "max_rounds": self.args.max_rounds
                }

                # Create a preview of the results
                total_rounds_completed = self._calculate_total_rounds(results)
                trace_output = {
                    "final_outcome": final_outcome,
                    "total_rounds": total_rounds_completed,
                    "final_offer": results[-1]["response"].get("offer") if results else None,
                    "conversation_summary": f"{total_rounds_completed} rounds completed"
                }

                # Note: Langfuse tracing is handled by @observe decorator
                # No need to manually update trace here
                logger.debug(f"Langfuse trace data collected (handled by @observe decorator)")
            except Exception as e:
                logger.debug(f"Note: {e}")

            return results
    
    def _load_existing_conversation(self) -> List[Dict[str, Any]]:
        """Load existing conversation if resuming a negotiation."""
        if not self.args.existing_conversation:
            return []
            
        try:
            existing = json.loads(self.args.existing_conversation)
            logger.debug(f"Resuming with {len(existing)} existing rounds")
            return existing
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse existing conversation: {e}")
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
                                   exchange_num: int, max_rounds: int, session: SQLiteSession,
                                   results: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Execute a single negotiation round with structured output and persistent session."""
        try:
            # DYNAMIC PROMPT UPDATE: Inject current round state into agent instructions
            original_instructions = agent.instructions
            try:
                # Build dynamic variables for this round
                dynamic_vars = self._build_dynamic_prompt_variables(role, results, exchange_num)

                # Update agent instructions with current round context
                updated_instructions = self._update_agent_instructions(role, dynamic_vars)
                agent.instructions = updated_instructions
            except Exception as e:
                logger.warning(f"Failed to update agent instructions: {e}. Using original.")
                agent.instructions = original_instructions

            # Execute agent with structured output (Pydantic model) and persistent session
            start_time = time.time()
            result = await Runner.run(agent, message, session=session)
            execution_time = time.time() - start_time

            logger.debug(f"{role} response time: {execution_time:.2f}s")

            # Restore original instructions
            agent.instructions = original_instructions

            # With output_type=NegotiationResponse, final_output is already a Pydantic model
            # Convert to dict for compatibility with existing code
            # Handle both structured and unstructured responses
            if isinstance(result.final_output, NegotiationResponse):
                response_data = result.final_output.model_dump()
            elif isinstance(result.final_output, dict):
                response_data = result.final_output
            else:
                # Fallback: try to parse as string (common for models without structured output)
                logger.debug(f"Parsing string response (type: {type(result.final_output).__name__})")
                response_str = str(result.final_output)

                # Handle case where response is a list with content field (some LLMs return this format)
                try:
                    import json
                    parsed = json.loads(response_str)
                    if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                        if 'content' in parsed[0]:
                            response_str = parsed[0]['content']
                            logger.debug("Extracted content from array response format")
                except Exception:
                    pass  # Not a JSON array, continue with original string

                # Clean up markdown code blocks (common issue with LLMs)
                # Remove ```json\n ... \n``` wrappers
                response_str = response_str.strip()
                if response_str.startswith('```'):
                    # Remove opening ```json or ```
                    lines = response_str.split('\n')
                    if lines[0].startswith('```'):
                        lines = lines[1:]  # Remove first line
                    # Remove closing ```
                    if lines and lines[-1].strip() == '```':
                        lines = lines[:-1]  # Remove last line
                    response_str = '\n'.join(lines).strip()
                    logger.debug("Cleaned markdown from response")

                try:
                    response_data = json.loads(response_str)
                except json.JSONDecodeError as e:
                    # Try to fix common JSON issues
                    logger.warning(f"Initial JSON parse failed: {e}. Attempting to fix...")

                    # If response is too long, it might be truncated mid-JSON
                    # Try to find the last complete closing brace
                    if len(response_str) > 3000:
                        logger.warning(f"Response is very long ({len(response_str)} chars), attempting to find valid JSON boundary")
                        # Find last occurrence of }}\n or }} at end
                        for i in range(len(response_str) - 1, max(0, len(response_str) - 500), -1):
                            if response_str[i] == '}':
                                try:
                                    truncated = response_str[:i+1]
                                    response_data = json.loads(truncated)
                                    logger.info(f"Successfully parsed truncated JSON at position {i}")
                                    break
                                except:
                                    continue
                        else:
                            raise ValueError(f"Could not parse response even after truncation: {response_str[:200]}... - Error: {e}")
                    else:
                        logger.error(f"Failed to parse response. Raw output (first 500 chars): {response_str[:500]}")
                        raise ValueError(f"Could not parse response: {response_str[:200]} - Error: {e}")

            # Normalize dimension values to ensure they're numeric and fix product key mismatches
            try:
                dims = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
                products = self.negotiation_data.get('products', []) if self.negotiation_data else []
                response_data = normalize_model_output(response_data, dims, products)
                logger.debug(f"Normalized output: {len(response_data.get('offer', {}).get('dimension_values', {}))} dimensions")
            except Exception as e:
                logger.warning(f"Normalization failed: {e}")

            return response_data

        except Exception as e:
            logger.error(f"Round {exchange_num} failed: {e}")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return None
    
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
    
    def _should_extend_negotiation(self, exchange_num: int, max_rounds: int, results: List[Dict]) -> bool:
        """Check if negotiation should be extended due to convergence."""
        if exchange_num < max_rounds or len(results) < 2 or exchange_num >= NegotiationConfig.ABSOLUTE_MAX_ROUNDS:
            return False
        
        # Check convergence
        last_offer = results[-1]["response"].get("offer", {}).get("dimension_values", {})
        prev_offer = results[-2]["response"].get("offer", {}).get("dimension_values", {})
        
        return analyze_convergence(last_offer, prev_offer)
    
    def _normalize_round_metadata(self, results: List[Dict[str, Any]]) -> None:
        """Ensure round/turn markers follow the new exchange definition."""
        for idx, entry in enumerate(results):
            turn_number = idx + 1
            exchange_num = (turn_number - 1) // 2 + 1
            entry.setdefault("turn", turn_number)
            entry["round"] = exchange_num
    
    def _calculate_total_rounds(self, results: List[Dict[str, Any]]) -> int:
        """Return the number of completed exchanges (rounds)."""
        if not results:
            return 0
        return max(r.get("round", 0) for r in results)
    
    def _finalize_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Finalize and format the negotiation results."""
        outcome = getattr(self, '_final_outcome', NegotiationOutcome.ERROR)
        
        # Determine final offer correctly
        # If deal accepted but last offer is empty (common when just saying "I accept"),
        # use the previous offer which was accepted
        final_offer = None
        if results:
            last_response = results[-1]["response"]
            final_offer = last_response.get("offer")
            
            # Check if we need to fallback to previous offer
            is_empty_offer = not final_offer or not final_offer.get("dimension_values")
            if outcome == NegotiationOutcome.DEAL_ACCEPTED and is_empty_offer and len(results) >= 2:
                prev_response = results[-2]["response"]
                prev_offer = prev_response.get("offer")
                if prev_offer and prev_offer.get("dimension_values"):
                    logger.info("Using offer from previous round as final agreed offer")
                    final_offer = prev_offer

        # Flatten conversation log structure to match frontend expectations
        conversation_log = []
        for result in results:
            response_data = result.get("response", {})
            conversation_log.append({
                "round": result.get("round", 0),
                "turn": result.get("turn"),
                "agent": result.get("agent", ""),
                "message": response_data.get("message", ""),
                "offer": response_data.get("offer", {}),
                "action": response_data.get("action", "continue"),
                "internal_analysis": response_data.get("internal_analysis", ""),
                "batna_assessment": response_data.get("batna_assessment", 0.5),
                "walk_away_threshold": response_data.get("walk_away_threshold", 0.3)
            })

        logger.debug(f"Prepared {len(conversation_log)} conversation entries")

        total_rounds_completed = self._calculate_total_rounds(results)
        
        # Create the final result
        final_result = {
            "outcome": outcome,
            "totalRounds": total_rounds_completed,
            "finalOffer": final_offer,
            "conversationLog": conversation_log,  # Use flattened structure
            "langfuseTraceId": getattr(self, '_trace_id', None)
        }

        # Log final offer for debugging
        if final_offer:
            dim_vals = final_offer.get("dimension_values", {})
            logger.info(f"[FINAL_OFFER] Returning final offer with {len(dim_vals)} dimensions: {list(dim_vals.keys())}")
        else:
            logger.warning("[FINAL_OFFER] No final offer - this will cause NULL deal value!")

        # Update Langfuse trace with complete input/output data
        try:
            langfuse_client = Langfuse()
            
            # Prepare input data for tracing
            context_data = self.negotiation_data.get('context', {}) if self.negotiation_data else {}
            trace_input = {
                "negotiation_id": self.args.negotiation_id,
                "simulation_run_id": self.args.simulation_run_id,
                "technique_id": self.args.technique_id,
                "tactic_id": self.args.tactic_id,
                "max_rounds": self.args.max_rounds,
                "negotiation_context": context_data,
                "agents_config": {
                    "buyer_role": context_data.get('userRole') if isinstance(context_data, dict) else None,
                    "negotiation_type": context_data.get('negotiationType') if isinstance(context_data, dict) else None
                }
            }
            
            # Prepare output data for tracing
            trace_output = {
                "outcome": outcome,
                "total_rounds": total_rounds_completed,
                "final_offer": final_offer,
                "success": outcome not in ['MAX_ROUNDS_REACHED', 'ERROR'],
                "conversation_summary": (
                    f"Negotiation completed with {total_rounds_completed} rounds, outcome: {outcome}"
                )
            }
            
            # Add metadata
            trace_metadata = {
                "service": "negotiation_agent_service",
                "version": "1.0.0",
                "langfuse_self_prompt_name": str(self.self_agent_prompt.name) if self.self_agent_prompt else None,
                "langfuse_self_prompt_version": str(self.self_agent_prompt.version) if self.self_agent_prompt else None,
                "langfuse_opponent_prompt_name": str(self.opponent_agent_prompt.name) if self.opponent_agent_prompt else None,
                "langfuse_opponent_prompt_version": str(self.opponent_agent_prompt.version) if self.opponent_agent_prompt else None,
            }
            
            # Note: Langfuse tracing is handled by @observe decorator
            logger.debug("Langfuse trace recorded")
        except Exception as e:
            logger.debug(f"Langfuse trace note: {e}")

        return final_result


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
    parser.add_argument('--self-agent-prompt', default='agents/self_agent', help='Langfuse prompt name for the configured user role')
    parser.add_argument('--opponent-agent-prompt', default='agents/opponent_agent', help='Langfuse prompt name for the opposing role')
    
    args = parser.parse_args()

    # Create and run negotiation service
    service = NegotiationService(args)
    result = await service.run_negotiation()

    # Ensure all Langfuse traces are flushed before exiting
    try:
        langfuse_client = Langfuse()
        langfuse_client.flush()
        logger.debug("Flushed Langfuse")
    except Exception as e:
        logger.warning(f"Failed to flush Langfuse: {e}")

    # Output result as JSON (must be last line for stdout parsing)
    print(json.dumps(result))

    # Exit with error code if negotiation failed
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
