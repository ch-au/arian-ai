#!/usr/bin/env python3
"""
AI Evaluation Service for Negotiation Simulations

This service analyzes completed negotiation simulations and generates
effectiveness scores using AI-generated analysis (OpenAI/Anthropic/Gemini via LiteLLM) with Langfuse tracing.

Features:
- Automatic evaluation triggered after successful simulations (DEAL_ACCEPTED/WALK_AWAY)
- Uses Langfuse prompt 'runEvaluation' (version-controlled in Langfuse)
- Structured output via Pydantic SimulationEvaluation model
- Full observability with automatic Langfuse tracing

Architecture:
    TypeScript Backend (simulation-queue.ts)
        ↓ subprocess spawn
    evaluate_simulation.py (this file)
        ↓ Langfuse prompt compilation
    AI Model via LiteLLM (OpenAI GPT-4o-mini, Anthropic Claude, or Gemini) with structured output
        ↓ SimulationEvaluation model
    JSON output to stdout

Output Format:
    {
      "simulationRunId": "abc-123",
      "evaluation": {
        "tactical_summary": "Analysis in German (2-3 sentences)",
        "influencing_effectiveness_score": 7,  // 1-10
        "tactic_effectiveness_score": 6        // 1-10
      }
    }

Called by: server/services/simulation-evaluation.ts (TypeScript)
"""

import argparse
import json
import os
import sys
from typing import Dict, Any
from langfuse import Langfuse
from langfuse.openai import openai  # Langfuse-wrapped OpenAI client for automatic tracing

# Import shared data model for type safety
try:
    from negotiation_models import SimulationEvaluation
except ImportError:
    # Handle direct execution
    sys.path.append(os.path.dirname(__file__))
    from negotiation_models import SimulationEvaluation


def get_langfuse_client() -> Langfuse:
    """
    Initialize Langfuse client with environment variables.

    Required environment variables:
    - LANGFUSE_SECRET_KEY: API secret key
    - LANGFUSE_PUBLIC_KEY: API public key
    - LANGFUSE_HOST: Optional, defaults to cloud.langfuse.com

    Returns:
        Langfuse: Configured client instance

    Raises:
        ValueError: If required credentials are missing
    """
    return Langfuse(
        secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
        public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
        host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
    )


def evaluate_simulation(
    conversation_log: list,
    role: str,
    technique_name: str,
    technique_description: str,
    tactic_name: str,
    tactic_description: str,
    counterpart_attitude: str,
    outcome: str,
    simulation_run_id: str = None,
) -> SimulationEvaluation:
    """
    Evaluate a simulation run using Langfuse prompt 'runEvaluation'.

    Model selection (same fallback logic as simulations):
    1. Check Langfuse prompt config for 'model' field
    2. Check environment variables (NEGOTIATION_MODEL or LITELLM_MODEL)
    3. Fallback to default: gemini/gemini-3-flash-preview

    Args:
        conversation_log: List of conversation rounds
        role: User role (BUYER/SELLER)
        technique_name: Name of influencing technique used
        technique_description: Description of technique
        tactic_name: Name of negotiation tactic used
        tactic_description: Description of tactic
        counterpart_attitude: Attitude/personality of counterpart
        outcome: Final outcome of the negotiation
        simulation_run_id: Optional simulation run ID for tracing

    Returns:
        SimulationEvaluation with tactical_summary and effectiveness scores
    """
    langfuse = get_langfuse_client()

    # Fetch the prompt from Langfuse
    prompt_name = "runEvaluation"
    try:
        prompt = langfuse.get_prompt(prompt_name)
        print(f"Retrieved Langfuse prompt: {prompt.name} v{prompt.version}", file=sys.stderr)
    except Exception as e:
        print(f"Error fetching prompt '{prompt_name}': {e}", file=sys.stderr)
        # Fallback or re-raise? Better to fail fast here.
        raise

    # Format conversation log with explicit Role/Self/Opponent distinction
    conversation_text = ""
    for round_data in conversation_log:
        agent = round_data.get("agent", "")
        message = round_data.get("message", "")
        offer = round_data.get("offer", {})
        
        # Determine perspective label
        # If the message agent matches the evaluated role -> "Self"
        # Otherwise -> "Opponent"
        role_label = f"{agent}"
        if role and agent:
            if agent.upper() == role.upper():
                role_label = f"Self ({agent})"
            else:
                role_label = f"Opponent ({agent})"
        
        offer_str = ""
        if offer and offer.get("dimension_values"):
             offer_str = f" [Offer: {json.dumps(offer.get('dimension_values'), ensure_ascii=False)}]"
        
        conversation_text += f"{role_label}: {message}{offer_str}\n\n"

    # Compile prompt with variables (matching user requirements)
    compiled_prompt = prompt.compile(
        role=role,
        conversation_log=conversation_text,
        technique_name=technique_name,
        technique_description=technique_description or "No description provided",
        tactic_name=tactic_name,
        tactic_description=tactic_description or "No description provided",
        counterpart_attitude=counterpart_attitude,
        outcome=outcome
    )

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

    # Resolve model configuration (same fallback logic as simulations)
    # 1. Check Langfuse prompt config
    model_config = getattr(prompt, "config", None)
    if isinstance(model_config, dict) and model_config.get("model"):
        model_name = model_config.get("model")
        print(f"Using model from Langfuse prompt config: {model_name}", file=sys.stderr)
    else:
        # 2. Check environment variables
        env_override = os.getenv("NEGOTIATION_MODEL") or os.getenv("LITELLM_MODEL")
        if env_override:
            model_name = env_override
            print(f"Using model from environment variable: {model_name}", file=sys.stderr)
        else:
            # 3. Fallback to default (same as simulations)
            model_name = "gemini/gemini-3-flash-preview"
            print(f"Using fallback model: {model_name}", file=sys.stderr)

    # Use Langfuse-wrapped OpenAI client for automatic tracing
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    messages = [
        {"role": "system", "content": "Du bist ein erfahrener Verhandlungsexperte und Coach."},
        {"role": "user", "content": compiled_prompt}
    ]

    # Call LLM with structured output (automatically traced by Langfuse wrapper)
    response = client.beta.chat.completions.parse(
        model=model_name,
        messages=messages,
        response_format=SimulationEvaluation,
    )

    evaluation = response.choices[0].message.parsed
    print(f"Evaluation generated: {evaluation.model_dump_json()}", file=sys.stderr)

    return evaluation


def main():
    parser = argparse.ArgumentParser(description="Evaluate simulation run")
    parser.add_argument("--simulation-run-id", required=True, help="Simulation run ID")
    parser.add_argument("--conversation-log", required=True, help="JSON conversation log")
    parser.add_argument("--role", required=True, help="User role (BUYER/SELLER)")
    
    parser.add_argument("--technique-name", required=True, help="Influencing technique name")
    parser.add_argument("--technique-description", required=False, default="", help="Influencing technique description")
    
    parser.add_argument("--tactic-name", required=True, help="Negotiation tactic name")
    parser.add_argument("--tactic-description", required=False, default="", help="Negotiation tactic description")
    
    parser.add_argument("--counterpart-attitude", required=True, help="Counterpart attitude description")
    parser.add_argument("--outcome", required=True, help="Final negotiation outcome")

    args = parser.parse_args()

    # Parse conversation log
    try:
        conversation_log = json.loads(args.conversation_log)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON for conversation log", file=sys.stderr)
        sys.exit(1)

    # Run evaluation
    try:
        evaluation = evaluate_simulation(
            conversation_log=conversation_log,
            role=args.role,
            technique_name=args.technique_name,
            technique_description=args.technique_description,
            tactic_name=args.tactic_name,
            tactic_description=args.tactic_description,
            counterpart_attitude=args.counterpart_attitude,
            outcome=args.outcome,
            simulation_run_id=args.simulation_run_id,
        )

        # Output as JSON
        result = {
            "simulationRunId": args.simulation_run_id,
            "evaluation": evaluation.model_dump()
        }

        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as e:
        print(f"Evaluation failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    sys.exit(main())
