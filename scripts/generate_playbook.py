#!/usr/bin/env python3
"""
Negotiation Playbook Generator using LLM

This script generates a comprehensive negotiation playbook from simulation data.
It uses Langfuse prompts and LiteLLM for multi-provider LLM support.

Usage:
    python generate_playbook.py --negotiation-id=<uuid>

Output:
    JSON with markdown playbook text
"""

import asyncio
import os
import json
import sys
import argparse
import logging
from typing import Dict, Any, Optional

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

# Import negotiation playbook data fetcher
try:
    from negotiation_playbook import get_negotiation_playbook_json
except ImportError:
    sys.path.append(os.path.dirname(__file__))
    from negotiation_playbook import get_negotiation_playbook_json

# Import Langfuse and LiteLLM
from langfuse import Langfuse
try:
    import litellm
except ImportError:
    logger.error("litellm not installed. Install with: pip install litellm")
    raise

# Import psycopg2 for database access
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    logger.error("psycopg2 not installed. Install with: pip install psycopg2-binary")
    raise


def get_db_connection():
    """Get database connection using DATABASE_URL."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(database_url)


def get_negotiation_metadata(negotiation_id: str) -> Dict[str, Any]:
    """
    Fetch negotiation metadata from database.

    Returns company name, opponent name, and negotiation title.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Get negotiation with related data
            cursor.execute("""
                SELECT
                    n.id,
                    n.title,
                    n.description,
                    n.scenario,
                    r.company as registration_company,
                    r.organization as registration_organization,
                    c.name as counterpart_name,
                    c.kind as counterpart_kind
                FROM negotiations n
                LEFT JOIN registrations r ON n.registration_id = r.id
                LEFT JOIN counterparts c ON n.counterpart_id = c.id
                WHERE n.id = %s
            """, (negotiation_id,))

            result = cursor.fetchone()

            if not result:
                raise ValueError(f"Negotiation {negotiation_id} not found")

            # Extract company name (prefer registration.company, fallback to scenario)
            company_name = result['registration_company'] or result['registration_organization']

            # Try to extract from scenario if not in registration
            if not company_name and result['scenario']:
                scenario = result['scenario']
                if isinstance(scenario, dict):
                    company_profile = scenario.get('companyProfile', {})
                    company_name = company_profile.get('company') or company_profile.get('organization')

            company_name = company_name or "Ihr Unternehmen"

            # Extract opponent name
            opponent_name = result['counterpart_name'] or "Verhandlungspartner"

            return {
                "company_name": company_name,
                "opponent_name": opponent_name,
                "negotiation_title": result['title'] or "Verhandlung",
                "description": result['description'] or ""
            }
    finally:
        conn.close()


async def generate_playbook(negotiation_id: str) -> Dict[str, Any]:
    """
    Generate a negotiation playbook using LLM.

    Only the top 15 runs (by deal value) include full conversation logs.
    All other runs only include summary data to keep the prompt manageable.

    Args:
        negotiation_id: UUID of the negotiation

    Returns:
        Dictionary with playbook markdown text
    """
    # Initialize Langfuse client
    langfuse = Langfuse()

    try:
        logger.info(f"Generating playbook for negotiation {negotiation_id}")

        # Create a root span for the playbook generation
        with langfuse.start_as_current_span(
            name="playbook-generation",
            metadata={
                "negotiation_id": negotiation_id,
            }
        ):
            # Step 1: Fetch negotiation metadata
            logger.info("Fetching negotiation metadata...")
            metadata = get_negotiation_metadata(negotiation_id)

            # Step 2: Fetch playbook data (all simulation runs)
            logger.info("Fetching simulation data...")
            from negotiation_playbook import get_negotiation_playbook_data
            all_runs = get_negotiation_playbook_data(negotiation_id)

            logger.info(f"Loaded {len(all_runs)} simulation runs")

            # Step 3: Sort by deal value (descending) and select top 15 for full logs
            runs_with_deal = [r for r in all_runs if r['summary'].get('dealValue') is not None]
            runs_without_deal = [r for r in all_runs if r['summary'].get('dealValue') is None]

            # Sort runs with deals by deal value
            runs_with_deal.sort(key=lambda r: r['summary']['dealValue'], reverse=True)

            # Top 15 get full conversation logs
            top_runs = runs_with_deal[:15]
            remaining_runs = runs_with_deal[15:] + runs_without_deal

            logger.info(f"Top 15 runs with full logs: {len(top_runs)}")
            logger.info(f"Remaining runs (summary only): {len(remaining_runs)}")

            # Remove conversation logs from remaining runs
            for run in remaining_runs:
                run['conversationLog'] = []  # Empty the log
                run['conversationLogNote'] = "Conversation log excluded for brevity"

            # Combine back together
            processed_runs = top_runs + remaining_runs

            # Convert to JSON
            import json
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
                    "total_runs": len(all_runs),
                    "top_runs": len(top_runs),
                },
                tags=["playbook", "generation", "production"]
            )

            # Step 4: Fetch prompt from Langfuse
            logger.info("Loading playbookGenerator prompt...")
            prompt = langfuse.get_prompt("playbookGenerator")

            if not prompt:
                raise RuntimeError("Langfuse prompt 'playbookGenerator' not found")

            logger.info(f"Using prompt: {prompt.name} v{prompt.version}")

            # Step 5: Get model configuration from prompt or use default
            model_config = getattr(prompt, "config", None)
            if isinstance(model_config, dict) and model_config.get("model"):
                model_name = model_config["model"]
                logger.info(f"Using model from Langfuse config: {model_name}")
            else:
                model_name = os.getenv("LITELLM_MODEL", "gemini/gemini-3-pro-preview")
                logger.info(f"Using default model: {model_name}")

            # Step 6: Compile prompt with variables
            logger.info("Compiling prompt with variables...")
            compiled_prompt = prompt.compile(
                company_name=metadata["company_name"],
                opponent_name=metadata["opponent_name"],
                negotiation_title=metadata["negotiation_title"],
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

            # Step 7: Call LLM via LiteLLM with Langfuse tracing
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
                # Use litellm.acompletion for async call
                response = await litellm.acompletion(
                    model=model_name,
                    messages=prompt_text,
                    temperature=0.7,
                    max_tokens=16000,
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

            # Step 8: Return result
            return {
                "success": True,
                "playbook": playbook_markdown,
                "metadata": {
                    "negotiation_id": negotiation_id,
                    "company_name": metadata["company_name"],
                    "opponent_name": metadata["opponent_name"],
                    "negotiation_title": metadata["negotiation_title"],
                    "model": model_name,
                    "prompt_version": prompt.version
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
        '--negotiation-id',
        required=True,
        help='UUID of the negotiation'
    )

    args = parser.parse_args()

    # Generate playbook
    result = await generate_playbook(args.negotiation_id)

    # Output as JSON
    print(json.dumps(result, ensure_ascii=False))

    # Exit with error code if failed
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
