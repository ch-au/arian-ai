#!/usr/bin/env python3
"""
AI Evaluation Service for Negotiation Simulations

This service analyzes completed negotiation simulations and generates
effectiveness scores using AI-generated analysis (OpenAI/Anthropic/Gemini via LiteLLM) with Langfuse tracing.

Features:
- Automatic evaluation triggered after successful simulations (DEAL_ACCEPTED/WALK_AWAY)
- Uses Langfuse prompt 'simulation_eval' (version-controlled in Langfuse)
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
    influence_technique: str,
    negotiation_tactic: str,
    counterpart_attitude: str,
    simulation_run_id: str = None,
) -> SimulationEvaluation:
    """
    Evaluate a simulation run using Langfuse prompt 'simulation_eval'.

    Args:
        conversation_log: List of conversation rounds
        role: User role (BUYER/SELLER)
        influence_technique: Name of influencing technique used
        negotiation_tactic: Name of negotiation tactic used
        counterpart_attitude: Attitude/personality of counterpart
        simulation_run_id: Optional simulation run ID for tracing

    Returns:
        SimulationEvaluation with tactical_summary and effectiveness scores
    """
    langfuse = get_langfuse_client()

    # Fetch the prompt from Langfuse
    prompt = langfuse.get_prompt("simulation_eval")
    print(f"Retrieved Langfuse prompt: {prompt.name} v{prompt.version}", file=sys.stderr)

    # Format conversation log
    conversation_text = ""
    for round_data in conversation_log:
        agent = round_data.get("agent", "")
        message = round_data.get("message", "")
        conversation_text += f"{agent}: {message}\n\n"

    # Compile prompt with variables
    compiled_prompt = prompt.compile(
        ROLLE=role,
        Verhandlung=conversation_text,
        influence=influence_technique,
        tactic=negotiation_tactic,
        attitute_counterpart=counterpart_attitude,
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

    # Use Langfuse-wrapped OpenAI client for automatic tracing
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    messages = [
        {"role": "system", "content": "Du bist ein Verhandlungsexperte."},
        {"role": "user", "content": compiled_prompt}
    ]

    # Call LLM with structured output (automatically traced by Langfuse wrapper)
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
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
    parser.add_argument("--influence-technique", required=True, help="Influencing technique name")
    parser.add_argument("--negotiation-tactic", required=True, help="Negotiation tactic name")
    parser.add_argument("--counterpart-attitude", required=True, help="Counterpart attitude description")

    args = parser.parse_args()

    # Parse conversation log
    conversation_log = json.loads(args.conversation_log)

    # Run evaluation
    evaluation = evaluate_simulation(
        conversation_log=conversation_log,
        role=args.role,
        influence_technique=args.influence_technique,
        negotiation_tactic=args.negotiation_tactic,
        counterpart_attitude=args.counterpart_attitude,
        simulation_run_id=args.simulation_run_id,
    )

    # Output as JSON
    result = {
        "simulationRunId": args.simulation_run_id,
        "evaluation": evaluation.model_dump()
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
