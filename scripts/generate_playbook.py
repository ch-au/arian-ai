#!/usr/bin/env python3
"""
Negotiation Playbook Generator using LLM

This script generates a comprehensive negotiation playbook from simulation data.
It uses Langfuse prompts and LiteLLM for multi-provider LLM support.

Usage:
    # Read data from stdin (recommended - Node.js fetches data)
    echo '{"negotiation_id": "...", ...}' | python generate_playbook.py --mode=stdin

    # Legacy: Fetch data from database (requires DATABASE_URL)
    python generate_playbook.py --negotiation-id=<uuid> --mode=db

Output:
    JSON with markdown playbook text
"""

import asyncio
import os
import json
import sys
import argparse
import logging
from typing import Dict, Any, List

# Configure logging to stderr
log_level = os.getenv('PYTHON_LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    stream=sys.stderr,
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)

logger = logging.getLogger(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv('.env')
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv()

# Import Langfuse and LiteLLM
from langfuse import Langfuse
try:
    import litellm
except ImportError:
    logger.error("litellm not installed. Install with: pip install litellm")
    raise


async def generate_playbook_from_data(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a negotiation playbook using LLM from pre-fetched data.

    This function receives all data from Node.js (which fetched it from DB)
    and only handles the LLM generation part.

    Args:
        input_data: Dictionary containing:
            - negotiation_id: UUID of the negotiation
            - company_name: Name of the user's company
            - opponent_name: Name of the counterpart
            - negotiation_title: Title of the negotiation
            - user_role: 'buyer' or 'seller'
            - user_role_label: German label for user role
            - opponent_role_label: German label for opponent role
            - simulation_runs: List of simulation run data

    Returns:
        Dictionary with playbook markdown text
    """
    # Initialize Langfuse client
    langfuse = Langfuse()

    negotiation_id = input_data.get('negotiation_id', 'unknown')

    try:
        logger.info(f"Generating playbook for negotiation {negotiation_id}")

        # Extract metadata from input
        metadata = {
            "company_name": input_data.get('company_name', 'Ihr Unternehmen'),
            "opponent_name": input_data.get('opponent_name', 'Verhandlungspartner'),
            "negotiation_title": input_data.get('negotiation_title', 'Verhandlung'),
            "description": input_data.get('description', ''),
            "user_role": input_data.get('user_role', 'seller'),
            "user_role_label": input_data.get('user_role_label', 'Verkäufer'),
            "opponent_role_label": input_data.get('opponent_role_label', 'Käufer'),
        }

        # Get simulation runs from input
        all_runs = input_data.get('simulation_runs', [])
        logger.info(f"Received {len(all_runs)} simulation runs from Node.js")

        # Create a root span for the playbook generation
        with langfuse.start_as_current_span(
            name="playbook-generation",
            metadata={
                "negotiation_id": negotiation_id,
                "mode": "stdin",
            }
        ):
            # Sort by deal value (descending) and select top 15 for full logs
            runs_with_deal = [r for r in all_runs if r.get('summary', {}).get('dealValue') is not None or r.get('deal_value') is not None]
            runs_without_deal = [r for r in all_runs if r.get('summary', {}).get('dealValue') is None and r.get('deal_value') is None]

            # Sort runs with deals by deal value
            def get_deal_value(r):
                return r.get('summary', {}).get('dealValue') or r.get('deal_value') or 0
            runs_with_deal.sort(key=get_deal_value, reverse=True)

            # Top 15 get full conversation logs
            top_runs = runs_with_deal[:15]
            remaining_runs = runs_with_deal[15:] + runs_without_deal

            logger.info(f"Top 15 runs with full logs: {len(top_runs)}")
            logger.info(f"Remaining runs (summary only): {len(remaining_runs)}")

            # Remove conversation logs from remaining runs
            for run in remaining_runs:
                run['conversation_log'] = []
                run['conversationLog'] = []
                run['conversationLogNote'] = "Conversation log excluded for brevity"

            # Combine back together
            processed_runs = top_runs + remaining_runs

            # Convert to JSON
            logs_json = json.dumps(processed_runs, ensure_ascii=False)

            # Update trace context with full metadata
            langfuse.update_current_trace(
                name="playbook-generation",
                user_id=negotiation_id,
                metadata={
                    "negotiation_id": negotiation_id,
                    "company_name": metadata["company_name"],
                    "opponent_name": metadata["opponent_name"],
                    "negotiation_title": metadata["negotiation_title"],
                    "user_role": metadata["user_role"],
                    "user_role_label": metadata["user_role_label"],
                    "total_runs": len(all_runs),
                    "top_runs": len(top_runs),
                    "mode": "stdin",
                },
                tags=["playbook", "generation", "production"]
            )

            # Fetch prompt from Langfuse
            logger.info("Loading playbookGenerator prompt...")
            prompt = langfuse.get_prompt("playbookGenerator")

            if not prompt:
                raise RuntimeError("Langfuse prompt 'playbookGenerator' not found")

            logger.info(f"Using prompt: {prompt.name} v{prompt.version}")

            # Get model configuration from prompt or use default
            model_config = getattr(prompt, "config", None)
            if isinstance(model_config, dict) and model_config.get("model"):
                model_name = model_config["model"]
                logger.info(f"Using model from Langfuse config: {model_name}")
            else:
                model_name = "gemini/gemini-3-pro-preview"
                logger.info(f"Using default model: {model_name}")

            # Compile prompt with variables
            logger.info("Compiling prompt with variables...")
            compiled_prompt = prompt.compile(
                company_name=metadata["company_name"],
                opponent_name=metadata["opponent_name"],
                negotiation_title=metadata["negotiation_title"],
                user_role=metadata["user_role"],
                user_role_label=metadata["user_role_label"],
                opponent_role_label=metadata["opponent_role_label"],
                logs=logs_json
            )

            # Handle different prompt formats
            if isinstance(compiled_prompt, list):
                # Chat messages format
                messages = []
                for msg in compiled_prompt:
                    if isinstance(msg, dict) and 'content' in msg:
                        messages.append(msg)
                    elif isinstance(msg, str):
                        messages.append({"role": "user", "content": msg})
                prompt_text = messages
            else:
                # Single string format - wrap in user message
                prompt_text = [{"role": "user", "content": str(compiled_prompt)}]

            logger.info(f"Prompt compiled: {len(str(prompt_text))} chars")

            # Call LLM via LiteLLM with Langfuse tracing
            logger.info(f"Calling LLM: {model_name}")

            # Create a generation observation
            with langfuse.start_as_current_observation(
                name="playbook-llm-generation",
                as_type="generation",
                input=prompt_text,
                model=model_name,
                metadata={
                    "prompt_name": prompt.name,
                    "prompt_version": prompt.version,
                    "temperature": 0.7,
                    "max_tokens": 16000,
                }
            ) as generation:
                # Use litellm.acompletion for async call with timeout
                response = await litellm.acompletion(
                    model=model_name,
                    messages=prompt_text,
                    temperature=0.7,
                    max_tokens=16000,
                    timeout=360,  # 6 minutes timeout for LLM call
                )

                # Extract response text
                playbook_markdown = response.choices[0].message.content

                # Post-process: Convert [uuid](Label) to [Label](uuid) for better markdown compatibility
                import re
                uuid_pattern = r'\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\(([^)]+)\)'
                playbook_markdown = re.sub(
                    uuid_pattern,
                    r'[\2](\1)',  # Swap: [uuid](label) -> [label](uuid)
                    playbook_markdown,
                    flags=re.IGNORECASE
                )

                # Update generation with output and usage
                generation.update(
                    output=playbook_markdown,
                    usage_details={
                        "input": response.usage.prompt_tokens if response.usage else 0,
                        "output": response.usage.completion_tokens if response.usage else 0,
                        "total": response.usage.total_tokens if response.usage else 0,
                    },
                )

            logger.info(f"Generated playbook: {len(playbook_markdown)} chars")

            # Update trace with success
            langfuse.update_current_trace(
                output={
                    "success": True,
                    "playbook_length": len(playbook_markdown),
                },
                metadata={
                    "result_model": model_name,
                    "result_prompt_version": prompt.version
                }
            )

            # Flush Langfuse to ensure trace is sent
            langfuse.flush()

            # Return result
            return {
                "success": True,
                "playbook": playbook_markdown,
                "metadata": {
                    "negotiation_id": negotiation_id,
                    "company_name": metadata["company_name"],
                    "opponent_name": metadata["opponent_name"],
                    "negotiation_title": metadata["negotiation_title"],
                    "user_role": metadata["user_role"],
                    "user_role_label": metadata["user_role_label"],
                    "opponent_role_label": metadata["opponent_role_label"],
                    "model": model_name,
                    "prompt_version": prompt.version,
                    "total_runs": len(all_runs),
                    "generated_at": None  # Will be set by backend/frontend
                }
            }

    except Exception as e:
        logger.error(f"Playbook generation failed: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)

        # Try to update trace with error if langfuse client exists
        try:
            if 'langfuse' in locals():
                langfuse.update_current_trace(
                    output={
                        "success": False,
                        "error": str(e)
                    }
                )
                langfuse.flush()
        except Exception as trace_error:
            logger.warning(f"Failed to update trace with error: {trace_error}")

        return {
            "success": False,
            "error": str(e)
        }


async def main():
    """Main entry point for CLI usage."""
    parser = argparse.ArgumentParser(
        description='Generate negotiation playbook using LLM'
    )
    parser.add_argument(
        '--mode',
        choices=['stdin', 'db'],
        default='stdin',
        help='Data source mode: stdin (receive from Node.js) or db (fetch from database)'
    )
    parser.add_argument(
        '--negotiation-id',
        help='UUID of the negotiation (required for db mode)'
    )

    args = parser.parse_args()

    if args.mode == 'stdin':
        # Read JSON data from stdin
        logger.info("Reading playbook data from stdin...")
        try:
            stdin_data = sys.stdin.read()
            if not stdin_data:
                raise ValueError("No data received on stdin")
            input_data = json.loads(stdin_data)
            logger.info(f"Received data for negotiation: {input_data.get('negotiation_id', 'unknown')[:8]}...")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse stdin JSON: {e}")
            print(json.dumps({"success": False, "error": f"Invalid JSON on stdin: {e}"}))
            sys.exit(1)

        # Generate playbook from provided data
        result = await generate_playbook_from_data(input_data)

    else:
        # Legacy mode: fetch from database
        if not args.negotiation_id:
            logger.error("--negotiation-id is required for db mode")
            print(json.dumps({"success": False, "error": "--negotiation-id is required for db mode"}))
            sys.exit(1)

        # Import database functions only when needed
        logger.warning("Using legacy db mode - consider using stdin mode instead")
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
        except ImportError:
            logger.error("psycopg2 not installed. Install with: pip install psycopg2-binary")
            print(json.dumps({"success": False, "error": "psycopg2 not installed"}))
            sys.exit(1)

        # For backward compatibility, generate from database
        # This path should rarely be used - prefer stdin mode
        print(json.dumps({"success": False, "error": "db mode not supported - use stdin mode"}))
        sys.exit(1)

    # Output as JSON
    print(json.dumps(result, ensure_ascii=False))

    # Exit with error code if failed
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
