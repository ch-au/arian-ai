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
from textwrap import dedent
from typing import Dict, Any, List, Optional

# Configure logging to stderr to avoid interfering with stdout JSON responses
logging.basicConfig(stream=sys.stderr, level=logging.WARNING)

# Apply nest_asyncio for compatibility with existing event loops
import nest_asyncio
nest_asyncio.apply()

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv('.env')

# Disable OpenAI Agents debug output that interferes with JSON parsing
import os
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
        safe_json_parse, analyze_convergence, format_dimensions_for_prompt,
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
        safe_json_parse, analyze_convergence, format_dimensions_for_prompt,
        generate_dimension_examples, generate_dimension_schema, setup_langfuse_tracing,
        calculate_dynamic_max_rounds, emit_round_update, normalize_model_output
    )

# Import external dependencies
from agents import Agent, Runner, SQLiteSession, trace, AgentOutputSchema
from agents.extensions.models.litellm_model import LitellmModel
from langfuse import get_client, observe, Langfuse


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
            
            # Initialize Langfuse client per integration docs
            self.langfuse = get_client()
            try:
                # Optional health check
                if hasattr(self.langfuse, "auth_check") and not self.langfuse.auth_check():
                    print("WARNING: Langfuse client authentication failed. Check keys/host.", file=sys.stderr)
            except Exception as e:
                print(f"DEBUG: Langfuse auth_check error (continuing): {e}", file=sys.stderr)

            # Get prompt template
            self.langfuse_prompt = self.langfuse.get_prompt("negotiation")
            print(f"DEBUG: Retrieved Langfuse prompt: {self.langfuse_prompt.name} v{self.langfuse_prompt.version}", file=sys.stderr)
            
            return True
            
        except Exception as e:
            print(f"ERROR: Service initialization failed: {e}", file=sys.stderr)
            return False
    
    
    def _create_agents(self) -> Optional[Dict[str, Agent]]:
        """Create buyer and seller AI agents with proper instructions."""
        try:
            # Get model configuration from Langfuse prompt (respects user's choice)
            model_config = getattr(self.langfuse_prompt, 'config', {})
            model_name = model_config.get('model', NegotiationConfig.DEFAULT_MODEL)

            print(f"DEBUG: Creating agents with model from Langfuse: {model_name}", file=sys.stderr)

            # Determine if we should use LiteLLM (for non-OpenAI models)
            model_obj = self._get_model_object(model_name)

            # Check if model supports structured output
            supports_structured = self._model_supports_structured_output(model_name)

            # Create instructions for both roles
            buyer_instructions = self._create_agent_instructions(AgentRole.BUYER)
            seller_instructions = self._create_agent_instructions(AgentRole.SELLER)

            # Create the agents with structured output using Pydantic (if supported)
            # Use AgentOutputSchema with strict_json_schema=False for flexibility
            output_schema = AgentOutputSchema(NegotiationResponse, strict_json_schema=False) if supports_structured else None

            if not supports_structured:
                print(f"WARNING: Model {model_name} doesn't support structured output - will parse JSON manually", file=sys.stderr)

            buyer_agent = Agent(
                name="Production Buyer Agent",
                instructions=buyer_instructions,
                model=model_obj,
                output_type=output_schema  # Enforce structured output
            )

            seller_agent = Agent(
                name="Production Seller Agent",
                instructions=seller_instructions,
                model=model_obj,
                output_type=output_schema  # Enforce structured output
            )
            
            return {
                AgentRole.BUYER: buyer_agent,
                AgentRole.SELLER: seller_agent
            }
            
        except Exception as e:
            print(f"ERROR: Agent creation failed: {e}", file=sys.stderr)
            return None

    def _get_model_object(self, model_name: str):
        """
        Get the appropriate model object (string for OpenAI, LitellmModel for others).

        Supports LiteLLM format: provider/model-name
        Examples:
        - "gpt-4o" or "openai/gpt-4o" -> OpenAI (string)
        - "anthropic/claude-3-5-sonnet-20241022" -> LiteLLM
        - "gemini/gemini-2.0-flash-exp" -> LiteLLM
        - "groq/llama-3.3-70b-versatile" -> LiteLLM
        """
        import os

        # If model contains "/" it's a LiteLLM provider/model format
        if "/" in model_name:
            provider, model = model_name.split("/", 1)

            # OpenAI models can use native client (faster)
            if provider.lower() == "openai":
                print(f"DEBUG: Using native OpenAI client for {model}", file=sys.stderr)
                return model

            # Get API key for the provider
            api_key = self._get_provider_api_key(provider)

            if not api_key:
                print(f"WARNING: No API key found for {provider}, will try without key", file=sys.stderr)

            print(f"DEBUG: Using LiteLLM for {provider}/{model}", file=sys.stderr)
            return LitellmModel(model=model_name, api_key=api_key)

        # No "/" means it's likely an OpenAI model (backward compatibility)
        print(f"DEBUG: Using native OpenAI client for {model_name}", file=sys.stderr)
        return model_name

    def _get_provider_api_key(self, provider: str) -> str:
        """Get API key for a specific provider."""
        import os

        # Map provider names to environment variable names
        provider_env_map = {
            "anthropic": "ANTHROPIC_API_KEY",
            "claude": "ANTHROPIC_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "google": "GEMINI_API_KEY",
            "groq": "GROQ_API_KEY",
            "cohere": "COHERE_API_KEY",
            "mistral": "MISTRAL_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
            "together": "TOGETHER_API_KEY",
            "replicate": "REPLICATE_API_KEY",
            "bedrock": "AWS_ACCESS_KEY_ID",
            "vertex": "GOOGLE_APPLICATION_CREDENTIALS",
        }

        env_var = provider_env_map.get(provider.lower(), f"{provider.upper()}_API_KEY")
        api_key = os.getenv(env_var)

        if api_key:
            print(f"DEBUG: Found API key for {provider} in {env_var}", file=sys.stderr)
        else:
            print(f"DEBUG: No API key found in {env_var} for {provider}", file=sys.stderr)

        return api_key

    def _model_supports_structured_output(self, model_name: str) -> bool:
        """
        Check if a model supports structured output with json_schema.

        Models that DON'T support structured output:
        - gemini-flash-lite-latest
        - Some older Gemini models
        - Some Groq models

        Models that DO support it:
        - OpenAI models (gpt-4o, gpt-4o-mini, etc.)
        - Claude models
        - Most Gemini Pro models
        """
        # Models known to NOT support structured output
        unsupported_models = [
            'gemini-flash-lite',
            'gemini-1.5-flash-8b',  # Lite variant
        ]

        # Check if model name contains any unsupported pattern
        model_lower = model_name.lower()
        for unsupported in unsupported_models:
            if unsupported in model_lower:
                return False

        # Default to True for OpenAI and most other models
        return True

    def _create_agent_instructions(self, role: str) -> str:
        """
        Create STATIC instructions for an AI agent (sections 1-6 and 8).
        Dynamic round information (section 7) will be passed per-round.

        Args:
            role: Either 'BUYER' or 'SELLER'

        Returns:
            Static system prompt string
        """
        # Build static prompt variables (sections 1-6)
        variables = self._build_static_prompt_variables(role)

        # Use Langfuse prompt if available, otherwise fallback to hardcoded template
        if self.langfuse_prompt:
            try:
                # Compile Langfuse prompt with variables
                compiled_prompt = self.langfuse_prompt.compile(**variables)

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

                print(f"DEBUG: Using Langfuse prompt '{self.langfuse_prompt.name}' v{self.langfuse_prompt.version}", file=sys.stderr)
                return compiled_prompt
            except Exception as e:
                print(f"WARNING: Failed to compile Langfuse prompt, using fallback: {e}", file=sys.stderr)

        # Fallback: Build static template (sections 1-6 and 8)
        static_template = self._get_static_prompt_template(variables)
        return static_template
    
    def _build_static_prompt_variables(self, role: str) -> Dict[str, str]:
        """Build STATIC variable substitutions for the agent instructions."""
        # Extract data with safe defaults
        negotiation = self.negotiation_data.get('negotiation', {}) if self.negotiation_data else {}
        context = self.negotiation_data.get('context', {}) if self.negotiation_data else {}
        technique = self.negotiation_data.get('technique', {}) if self.negotiation_data else {}
        tactic = self.negotiation_data.get('tactic', {}) if self.negotiation_data else {}
        dimensions = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
        products = self.negotiation_data.get('products', []) if self.negotiation_data else []

        # Ensure all are proper types
        negotiation = negotiation if isinstance(negotiation, dict) else {}
        context = context if isinstance(context, dict) else {}
        technique = technique if isinstance(technique, dict) else {}
        tactic = tactic if isinstance(tactic, dict) else {}
        dimensions = dimensions if isinstance(dimensions, list) else []
        products = products if isinstance(products, list) else []

        # Generate dimension information
        dimension_examples = generate_dimension_examples(dimensions)
        dimension_details = format_dimensions_for_prompt(dimensions)
        dimension_schema = generate_dimension_schema(dimensions)

        # Format products information for the prompt
        products_info = self._format_products_for_prompt(products, role)

        # Context blobs formatted as compact JSON strings if present
        try:
            context_market_conditions = json.dumps(context.get('marketConditions', {}), ensure_ascii=False)
        except Exception:
            context_market_conditions = ""
        try:
            context_baseline_values = json.dumps(context.get('baselineValues', {}), ensure_ascii=False)
        except Exception:
            context_baseline_values = ""
        try:
            negotiation_metadata = json.dumps(negotiation.get('metadata', {}), ensure_ascii=False)
        except Exception:
            negotiation_metadata = ""
        
        # Technique/tactic mappings from CSV-backed columns
        def _fmt_list_or_str(val):
            if isinstance(val, list):
                return ", ".join([str(v) for v in val])
            return val or ""
        
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

            # Products information (actual negotiation items with prices and volumes)
            'products_info': products_info,

            # Market & Situation
            # IMPORTANT: Use negotiation's own description if available, fallback to context
            'context_description': negotiation.get('productMarketDescription') or context.get('description', 'Nicht verfügbar'),
            'context_market_conditions': context_market_conditions if context_market_conditions and context_market_conditions != '{}' else '{}',
            'context_baseline_values': context_baseline_values if context_baseline_values and context_baseline_values != '{}' else '{}',
            'negotiation_metadata': negotiation_metadata,
            
            # Personality (best-effort placeholders unless joined elsewhere)
            'personality_traits': 'Strategic, professional, goal-oriented',
            'personality_type_name': 'Business Negotiator',
            'personality_type_description': 'Nicht verfügbar',
            'personality_behavior': '',
            'personality_advantages': '',
            'personality_risks': '',
            'personality_instructions': 'Be professional and strategic',
            
            # Technique and tactic information
            'technique_name': technique.get('name', 'Strategic Negotiation'),
            'technique_description': technique.get('description', technique.get('beschreibung', 'Professional negotiation approach')),
            'technique_application': technique.get('anwendung', technique.get('application', 'Nicht verfügbar')),
            'technique_key_aspects': _fmt_list_or_str(technique.get('wichtigeAspekte')),
            'technique_key_phrases': _fmt_list_or_str(technique.get('keyPhrases')),
            'tactic_name': tactic.get('name', 'Professional Approach'),
            'tactic_description': tactic.get('description', tactic.get('beschreibung', 'Maintain professional standards')),
            'tactic_application': tactic.get('anwendung', tactic.get('application', 'Nicht verfügbar')),
            'tactic_key_aspects': _fmt_list_or_str(tactic.get('wichtigeAspekte')),
            'tactic_key_phrases': _fmt_list_or_str(tactic.get('keyPhrases')),
            
            # Dimensions and boundaries
            'zopa_boundaries': dimension_details,
            'dimension_details': dimension_details,
            'dimension_examples': dimension_examples,
            'dimension_schema': dimension_schema,

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

    def _format_products_for_prompt(self, products: List[Dict], role: str) -> str:
        """Format product information for the negotiation prompt."""
        if not products or len(products) == 0:
            return "Keine spezifischen Produkte definiert."

        product_lines = []
        for product in products:
            name = product.get('produktName', 'Unbekanntes Produkt')
            ziel_preis = product.get('zielPreis', 0)
            min_max_preis = product.get('minMaxPreis', 0)
            volumen = product.get('geschätztesVolumen', 0)

            # For buyer: minMaxPreis is max acceptable price
            # For seller: minMaxPreis is min acceptable price
            if role == AgentRole.BUYER:
                product_lines.append(
                    f"- {name}: Zielpreis €{ziel_preis}, Maximalpreis €{min_max_preis}, "
                    f"Geschätztes Volumen: {volumen:,} Einheiten"
                )
            else:  # SELLER
                product_lines.append(
                    f"- {name}: Zielpreis €{ziel_preis}, Minimalpreis €{min_max_preis}, "
                    f"Geschätztes Volumen: {volumen:,} Einheiten"
                )

        return "\n".join(product_lines)

    def _build_round_message(self, role: str, results: List[Dict[str, Any]], round_num: int) -> str:
        """
        Build the dynamic per-round user message (Section 7: RUNDDYNAMIK).
        Includes opponent's last response AND your own internal analysis from previous round.
        """
        # Get counterpart's last message and offer
        if results:
            # Find the last message from the OPPONENT
            counterpart_role = AgentRole.get_opposite_role(role)
            counterpart_messages = [r for r in results if r.get("agent") != role]
            if counterpart_messages:
                last_counter = counterpart_messages[-1].get("response", {})
                last_counter_message = last_counter.get("message", "")
                last_counter_offer = last_counter.get("offer", {}).get("dimension_values", {})
            else:
                last_counter_message = "Dies ist die erste Runde der Verhandlung."
                last_counter_offer = {}
        else:
            last_counter_message = "Dies ist die erste Runde der Verhandlung."
            last_counter_offer = {}

        # Get YOUR OWN last internal analysis for continuity
        my_rounds = [r for r in results if r.get("agent") == role]
        if my_rounds:
            last_my_round = my_rounds[-1]
            my_last_internal = last_my_round.get("response", {}).get("internal_analysis", "")
            my_last_action = last_my_round.get("response", {}).get("action", "continue")
        else:
            my_last_internal = ""
            my_last_action = ""

        # Build internal state summary from YOUR OWN recent actions
        my_recent_rounds = [r for r in results[-3:] if r.get("agent") == role]
        recent_actions = [r.get("response", {}).get("action", "continue") for r in my_recent_rounds]
        action_summary = f"Ihre letzten Aktionen: {', '.join(recent_actions) if recent_actions else 'Erste Runde'}. Gesamtrunden bisher: {len(results)}"

        # Get dimension schema for reminder
        dims = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
        schema_inner = generate_dimension_schema(dims)

        # Build round message with internal analysis context
        message = f"""## AKTUELLE RUNDDYNAMIK (Runde {round_num})

Gegenangebot der Gegenseite:
"{last_counter_message}"

Angebotswerte der Gegenseite: {json.dumps(last_counter_offer, ensure_ascii=False) if last_counter_offer else "Noch kein konkretes Angebot"}
"""

        # Add YOUR previous internal analysis for memory continuity
        if my_last_internal:
            message += f"""
Ihre letzte interne Analyse (zur Erinnerung):
"{my_last_internal}"

Ihre letzte Aktion: {my_last_action}
"""

        message += f"""
Verhandlungsfortschritt: {action_summary}

Ihre Antwort wird automatisch strukturiert. Dimension-Schema für offer.dimension_values:
{{ {schema_inner} }}"""

        return message
    
    def _get_static_prompt_template(self, variables: Dict[str, str]) -> str:
        """Build the complete static prompt template with variables replaced."""
        # Generate dimension schema for the template
        dims = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
        dimension_schema = generate_dimension_schema(dims)

        template = (
            f"# Rolle: EXPERT-VERHANDLUNGSAGENT\n"
            f"Sie vertreten die Perspektive {variables['role_perspective']} in dieser Verhandlung. "
            f"Bleiben Sie professionell, strategisch und denken Sie mehrdimensional. "
            f"Alle Antworten müssen auf Deutsch erfolgen.\n\n"

            f"## 1. VERHANDLUNGSKONTEXT\n"
            f"Ihre Rolle: {variables['agent_role']}\n"
            f"Titel: \"{variables['negotiation_title']}\"\n"
            f"Verhandlungstyp: {variables['negotiation_type']}\n"
            f"Beziehungsstatus: {variables['relationship_type']}\n"
            f"Produkt- / Leistungsbeschreibung: {variables['product_description']}\n"
            f"Zusätzliche Hinweise: {variables['additional_comments']}\n\n"
            f"WICHTIG - Zu verhandelnde Produkte:\n"
            f"{variables['products_info']}\n\n"

            f"## 2. MARKT- & SITUATIONSEINORDNUNG\n"
            f"Kontextbeschreibung: {variables['context_description']}\n"
            f"Marktbedingungen: {variables.get('context_market_conditions', 'Nicht verfügbar')}\n"
            f"Baseline-Werte / Benchmarks: {variables.get('context_baseline_values', 'Nicht verfügbar')}\n"
            f"Weitere Metadaten: {variables.get('negotiation_metadata', 'Nicht verfügbar')}\n\n"

            f"## 3. PSYCHOLOGISCHES PROFIL\n"
            f"Persönlichkeitstyp: {variables.get('personality_type_name', 'Standard')}\n"
            f"Beschreibung: {variables.get('personality_type_description', 'Professioneller Verhandler')}\n"
            f"Verhaltensschwerpunkte: {variables.get('personality_behavior', 'Strategisch und zielorientiert')}\n"
            f"Stärken: {variables.get('personality_advantages', 'Analytisch, geduldig')}\n"
            f"Risiken: {variables.get('personality_risks', 'Keine besonderen')}\n\n"

            f"## 4. PSYCHOLOGISCHE TECHNIK\n"
            f"Name: {variables['technique_name']}\n"
            f"Kernaussage: {variables['technique_description']}\n"
            f"Praktische Anwendung: {variables['technique_application']}\n"
            f"Wichtige Aspekte: {variables['technique_key_aspects']}\n"
            f"Typische Formulierungen: {variables['technique_key_phrases']}\n\n"

            f"## 5. STRATEGISCHE TAKTIK\n"
            f"Name: {variables['tactic_name']}\n"
            f"Beschreibung: {variables['tactic_description']}\n"
            f"Empfohlene Anwendung: {variables['tactic_application']}\n"
            f"Wichtige Aspekte: {variables['tactic_key_aspects']}\n"
            f"Schlüsselphrasen: {variables['tactic_key_phrases']}\n\n"

            f"## 6. VERHANDLUNGSDIMENSIONEN & ZIELE\n"
            f"Dimensionen und Grenzen:\n"
            f"{variables['dimension_details']}\n\n"
            f"Hinweise:\n"
            f"- Halten Sie sich strikt an die Min/Max-Grenzen je Dimension.\n"
            f"- Priorität 1 = kritische Dimension, Priorität 3 = flexibel.\n"
            f"- Beispiele für Angebotswerte: {variables['dimension_examples']}\n\n"

            f"## 8. ANTWORTFORMAT (Strukturierte JSON-Ausgabe):\n"
            f"WICHTIG: Antworten Sie NUR mit gültigem JSON, keine zusätzlichen Text oder Markdown-Codeblöcke.\n"
            f"Ihre Antwort muss EXAKT folgende Struktur haben:\n\n"
            f"{{\n"
            f"  \"message\": \"Ihre professionelle Nachricht an die Gegenseite (auf Deutsch). Gehen Sie explizit auf das letzte Gegenangebot ein.\",\n"
            f"  \"action\": \"continue|accept|terminate|walk_away|pause\",\n"
            f"  \"offer\": {{\n"
            f"    \"dimension_values\": {{ {dimension_schema} }},\n"
            f"    \"confidence\": 0.85,\n"
            f"    \"reasoning\": \"Kurze Begründung Ihrer Angebotslogik\"\n"
            f"  }},\n"
            f"  \"internal_analysis\": \"Ihre private strategische Einschätzung - wird in der nächsten Runde an Sie zurückgegeben zur Kontinuität\",\n"
            f"  \"batna_assessment\": 0.7,\n"
            f"  \"walk_away_threshold\": 0.3\n"
            f"}}\n\n"

            f"### Wichtige Hinweise:\n"
            f"- **message**: Öffentliche Nachricht, sichtbar für die Gegenseite\n"
            f"- **action**: Ihre strategische Entscheidung für diese Runde\n"
            f"- **offer.dimension_values**: Numerische Werte für alle Dimensionen (innerhalb Min/Max)\n"
            f"- **offer.confidence**: Wie sicher sind Sie bei diesem Angebot?\n"
            f"- **offer.reasoning**: Private Begründung für Ihr Angebot\n"
            f"- **internal_analysis**: KRITISCH - Ihre strategischen Gedanken, die Sie in der nächsten Runde wieder sehen werden\n"
            f"- **batna_assessment**: Wie gut sind Ihre Alternativen außerhalb dieser Verhandlung?\n"
            f"- **walk_away_threshold**: Unter welchem BATNA-Level würden Sie abbrechen?\n\n"

            f"### Anforderungen:\n"
            f"- Beziehen Sie sich explizit auf das letzte Angebot der Gegenseite\n"
            f"- Begründen Sie jede Veränderung an den Dimensionen\n"
            f"- Verwenden Sie Technik und Taktik subtil, ohne sie zu benennen\n"
            f"- Vermeiden Sie Werte außerhalb der zulässigen Grenzen\n"
            f"- Bleiben Sie konsistent mit Ihrer Rolle und Persönlichkeit\n"
            f"- Nutzen Sie internal_analysis als Ihr strategisches Gedächtnis"
        )
        return template

    def _get_structured_output_instructions(self) -> str:
        """DEPRECATED - now integrated into _get_static_prompt_template."""
        return ""  # Empty since we moved this into the static template
    
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
                "langfuse_prompt_name": str(self.langfuse_prompt.name),
                "langfuse_prompt_version": str(self.langfuse_prompt.version),
            }
        ) as current_trace:
            # Store trace ID for later use
            self._trace_id = current_trace.trace_id

            # Initialize persistent session for the entire negotiation
            # Session automatically tracks conversation history across rounds
            session = SQLiteSession(f"production_{self.args.simulation_run_id}")
            results = self._load_existing_conversation()

            # Use configured max rounds directly (no dynamic calculation)
            max_rounds = self.args.max_rounds
            print(f"DEBUG: Starting negotiation with configured max {max_rounds} rounds", file=sys.stderr)
            print(f"DEBUG: Using persistent session: production_{self.args.simulation_run_id}", file=sys.stderr)

            # Build per-round messages dynamically based on latest state
            final_outcome = NegotiationOutcome.ERROR  # Default

            try:
                round_num = len(results)
                while round_num < max_rounds:
                    round_num += 1

                    # Determine which agent's turn it is
                    role = AgentRole.BUYER if round_num % 2 == 1 else AgentRole.SELLER
                    agent = agents[role]

                    print(f"DEBUG: Round {round_num} - {role} turn", file=sys.stderr)

                    # Build dynamic per-round message (Section 7)
                    round_message = self._build_round_message(role, results, round_num)

                    # Execute round with persistent session
                    response_data = await self._execute_single_round(
                        agent, role, round_message, round_num, max_rounds, session
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
                trace_output = {
                    "final_outcome": final_outcome,
                    "total_rounds": len(results),
                    "final_offer": results[-1]["response"].get("offer") if results else None,
                    "conversation_summary": f"{len(results)} rounds completed"
                }

                langfuse_client = get_client()
                langfuse_client.update_current_trace(
                    input=trace_input,
                    output=trace_output
                )
                print(f"DEBUG: Updated Langfuse trace with input/output data (in context)", file=sys.stderr)
            except Exception as e:
                print(f"WARNING: Failed to update Langfuse trace in context: {e}", file=sys.stderr)

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
                                   round_num: int, max_rounds: int, session: SQLiteSession) -> Optional[Dict[str, Any]]:
        """Execute a single negotiation round with structured output and persistent session."""
        try:
            # Execute agent with structured output (Pydantic model) and persistent session
            start_time = time.time()
            result = await Runner.run(agent, message, session=session)
            execution_time = time.time() - start_time

            # With output_type=NegotiationResponse, final_output is already a Pydantic model
            # Convert to dict for compatibility with existing code
            if isinstance(result.final_output, NegotiationResponse):
                response_data = result.final_output.model_dump()
                print(f"DEBUG: Received structured response from {role}", file=sys.stderr)
            else:
                # Fallback: parse as JSON if not structured (shouldn't happen with output_type set)
                response_data = safe_json_parse(str(result.final_output))
                print(f"WARNING: Received unstructured response from {role}, parsed as JSON", file=sys.stderr)

            # Normalize dimension values to ensure they're numeric
            try:
                dims = self.negotiation_data.get('dimensions', []) if self.negotiation_data else []
                response_data = normalize_model_output(response_data, dims)
            except Exception as e:
                print(f"WARNING: Normalization failed: {e}", file=sys.stderr)

            return response_data

        except Exception as e:
            print(f"ERROR: Round {round_num} failed: {e}", file=sys.stderr)
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

        # Flatten conversation log structure to match frontend expectations
        conversation_log = []
        for result in results:
            response_data = result.get("response", {})
            conversation_log.append({
                "round": result.get("round", 0),
                "agent": result.get("agent", ""),
                "message": response_data.get("message", ""),
                "offer": response_data.get("offer", {}),
                "action": response_data.get("action", "continue"),
                "internal_analysis": response_data.get("internal_analysis", ""),
                "batna_assessment": response_data.get("batna_assessment", 0.5),
                "walk_away_threshold": response_data.get("walk_away_threshold", 0.3)
            })

        print(f"DEBUG: Flattened conversation log with {len(conversation_log)} rounds", file=sys.stderr)
        if conversation_log:
            print(f"DEBUG: Sample conversation entry: {json.dumps(conversation_log[0], indent=2)[:200]}...", file=sys.stderr)

        # Create the final result
        final_result = {
            "outcome": outcome,
            "totalRounds": len(results),
            "finalOffer": final_offer,
            "conversationLog": conversation_log,  # Use flattened structure
            "langfuseTraceId": getattr(self, '_trace_id', None)
        }

        # Update Langfuse trace with complete input/output data
        try:
            langfuse_client = get_client()
            
            # Prepare input data for tracing
            trace_input = {
                "negotiation_id": self.args.negotiation_id,
                "simulation_run_id": self.args.simulation_run_id,
                "technique_id": self.args.technique_id,
                "tactic_id": self.args.tactic_id,
                "max_rounds": self.args.max_rounds,
                "negotiation_context": self.negotiation_data.get('context', {}) if self.negotiation_data else {},
                "agents_config": {
                    "buyer_role": self.negotiation_data.get('userRole') if self.negotiation_data else None,
                    "negotiation_type": self.negotiation_data.get('negotiationType') if self.negotiation_data else None
                }
            }
            
            # Prepare output data for tracing
            trace_output = {
                "outcome": outcome,
                "total_rounds": len(results),
                "final_offer": final_offer,
                "success": outcome not in ['MAX_ROUNDS_REACHED', 'ERROR'],
                "conversation_summary": f"Negotiation completed with {len(results)} rounds, outcome: {outcome}"
            }
            
            # Add metadata
            trace_metadata = {
                "service": "negotiation_agent_service",
                "version": "1.0.0",
                "langfuse_prompt_name": str(self.langfuse_prompt.name) if self.langfuse_prompt else None,
                "langfuse_prompt_version": str(self.langfuse_prompt.version) if self.langfuse_prompt else None,
            }
            
            langfuse_client.update_current_trace(
                input=trace_input,
                output=trace_output,
                metadata=trace_metadata,
                tags=["negotiation", "openai-agents", "production"],
                session_id=self.args.simulation_run_id,
                user_id=self.args.negotiation_id
            )
            print(f"DEBUG: Updated Langfuse trace with complete input/output data", file=sys.stderr)
        except Exception as e:
            print(f"WARNING: Failed to update Langfuse trace with input/output: {e}", file=sys.stderr)

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
