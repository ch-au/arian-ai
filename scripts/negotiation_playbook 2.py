#!/usr/bin/env python3
"""
Negotiation Playbook Generator

This module provides functions to extract negotiation data from the database
and format it as JSON for AI-based playbook generation.

For each simulation run, it includes:
- ID from database
- Name (from technique and tactic)
- AI-generated summary (tactic summary, scoring, deal value, offers)
- Conversation log with metadata

Usage:
    from negotiation_playbook import get_negotiation_playbook_data

    data = get_negotiation_playbook_data("negotiation-uuid")
    print(json.dumps(data, indent=2))
"""

import json
import os
import sys
import logging
from typing import Dict, Any, List, Optional
from decimal import Decimal

# Configure logging
logger = logging.getLogger(__name__)

# Database connection - using same pattern as other scripts
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    logger.error("psycopg2 not installed. Install with: pip install psycopg2-binary")
    raise


def get_db_connection():
    """
    Get a database connection using the DATABASE_URL environment variable.

    Returns:
        psycopg2 connection object

    Raises:
        ValueError: If DATABASE_URL is not set
    """
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")

    return psycopg2.connect(database_url)


def decimal_to_float(obj: Any) -> Any:
    """
    Convert Decimal objects to float for JSON serialization.

    Args:
        obj: Object that may contain Decimal values

    Returns:
        Object with Decimals converted to floats
    """
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(item) for item in obj]
    return obj


def get_negotiation_playbook_data(negotiation_id: str) -> List[Dict[str, Any]]:
    """
    Get all simulation run data for a negotiation in playbook format.

    This function retrieves comprehensive data for each simulation run including:
    - Run identification (ID, name from technique+tactic)
    - Performance summary (scores, deal value, outcome)
    - Product results (prices, targets, performance)
    - Dimension results (achieved targets, priorities)
    - Full conversation log with metadata
    - Additional metadata (technique, tactic, personality, timing, costs)

    Args:
        negotiation_id: UUID of the negotiation

    Returns:
        List of dictionaries, each representing one simulation run

    Example:
        >>> data = get_negotiation_playbook_data("123e4567-e89b-12d3-a456-426614174000")
        >>> print(f"Found {len(data)} simulation runs")
        >>> for run in data:
        ...     print(f"Run: {run['name']}, Outcome: {run['summary']['outcome']}")
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Get all simulation runs with their techniques and tactics
            cursor.execute("""
                SELECT
                    sr.id,
                    sr.negotiation_id,
                    sr.technique_id,
                    sr.tactic_id,
                    sr.personality_id,
                    sr.zopa_distance,
                    sr.status,
                    sr.outcome,
                    sr.outcome_reason,
                    sr.total_rounds,
                    sr.run_number,
                    sr.execution_order,
                    sr.started_at,
                    sr.completed_at,
                    sr.deal_value,
                    sr.other_dimensions,
                    sr.conversation_log,
                    sr.actual_cost,
                    sr.technique_effectiveness_score,
                    sr.tactic_effectiveness_score,
                    sr.tactical_summary,
                    sr.langfuse_trace_id,
                    it.name as technique_name,
                    nt.name as tactic_name
                FROM simulation_runs sr
                LEFT JOIN influencing_techniques it ON sr.technique_id = it.id
                LEFT JOIN negotiation_tactics nt ON sr.tactic_id = nt.id
                WHERE sr.negotiation_id = %s
                ORDER BY sr.execution_order ASC NULLS LAST, sr.run_number ASC
            """, (negotiation_id,))

            runs = cursor.fetchall()

            if not runs:
                logger.warning(f"No simulation runs found for negotiation {negotiation_id}")
                return []

            playbook_data = []

            for run in runs:
                run_id = run['id']

                # Get product results for this run
                cursor.execute("""
                    SELECT
                        product_name,
                        target_price,
                        agreed_price,
                        price_vs_target,
                        performance_score,
                        subtotal,
                        min_max_price,
                        within_zopa,
                        zopa_utilization
                    FROM product_results
                    WHERE simulation_run_id = %s
                    ORDER BY product_name
                """, (run_id,))

                product_results = cursor.fetchall()

                # Get dimension results for this run
                cursor.execute("""
                    SELECT
                        dimension_name,
                        final_value,
                        target_value,
                        achieved_target,
                        priority_score,
                        improvement_over_batna
                    FROM dimension_results
                    WHERE simulation_run_id = %s
                    ORDER BY priority_score DESC
                """, (run_id,))

                dimension_results = cursor.fetchall()

                # Build run name from technique and tactic
                technique_name = run['technique_name'] or "No Technique"
                tactic_name = run['tactic_name'] or "No Tactic"
                run_name = f"{technique_name} + {tactic_name}"

                # Parse conversation log (stored as JSONB)
                conversation_log = run['conversation_log'] if run['conversation_log'] else []

                # Build the playbook run data structure
                playbook_run = {
                    "id": run_id,
                    "name": run_name,
                    "summary": {
                        "tacticSummary": run['tactical_summary'],
                        "techniqueEffectivenessScore": decimal_to_float(run['technique_effectiveness_score']),
                        "tacticEffectivenessScore": decimal_to_float(run['tactic_effectiveness_score']),
                        "dealValue": decimal_to_float(run['deal_value']),
                        "outcome": run['outcome'],
                        "outcomeReason": run['outcome_reason'],
                        "totalRounds": run['total_rounds'],
                    },
                    "performance": {
                        "productResults": [
                            {
                                "productName": p['product_name'],
                                "targetPrice": decimal_to_float(p['target_price']),
                                "agreedPrice": decimal_to_float(p['agreed_price']),
                                "minMaxPrice": decimal_to_float(p['min_max_price']),
                                "priceVsTarget": decimal_to_float(p['price_vs_target']),
                                "performanceScore": decimal_to_float(p['performance_score']),
                                "subtotal": decimal_to_float(p['subtotal']),
                                "withinZopa": p['within_zopa'],
                                "zopaUtilization": decimal_to_float(p['zopa_utilization']),
                            }
                            for p in product_results
                        ],
                        "dimensionResults": [
                            {
                                "dimensionName": d['dimension_name'],
                                "finalValue": decimal_to_float(d['final_value']),
                                "targetValue": decimal_to_float(d['target_value']),
                                "achievedTarget": d['achieved_target'],
                                "priorityScore": d['priority_score'],
                                "improvementOverBatna": decimal_to_float(d['improvement_over_batna']),
                            }
                            for d in dimension_results
                        ],
                    },
                    "conversationLog": conversation_log,
                    "metadata": {
                        "technique": run['technique_name'],
                        "tactic": run['tactic_name'],
                        "personality": run['personality_id'],
                        "zopaDistance": run['zopa_distance'],
                        "startedAt": run['started_at'].isoformat() if run['started_at'] else None,
                        "completedAt": run['completed_at'].isoformat() if run['completed_at'] else None,
                        "actualCost": decimal_to_float(run['actual_cost']),
                        "langfuseTraceId": run['langfuse_trace_id'],
                        "status": run['status'],
                        "runNumber": run['run_number'],
                        "executionOrder": run['execution_order'],
                    },
                }

                playbook_data.append(playbook_run)

            logger.info(f"Retrieved playbook data for {len(playbook_data)} simulation runs")
            return playbook_data

    finally:
        conn.close()


def get_negotiation_playbook_json(negotiation_id: str, pretty: bool = True) -> str:
    """
    Get negotiation playbook data as a JSON string.

    This is a convenience wrapper around get_negotiation_playbook_data()
    that returns a JSON string instead of Python objects.

    Args:
        negotiation_id: UUID of the negotiation
        pretty: If True, format JSON with indentation (default: True)

    Returns:
        JSON string containing playbook data

    Example:
        >>> json_str = get_negotiation_playbook_json("123e4567-e89b-12d3-a456-426614174000")
        >>> # Can be directly used in AI prompts
        >>> prompt = f"Analyze these negotiations: {json_str}"
    """
    data = get_negotiation_playbook_data(negotiation_id)
    indent = 2 if pretty else None
    return json.dumps(data, indent=indent, ensure_ascii=False)


def get_multiple_negotiations_playbook_data(negotiation_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get playbook data for multiple negotiations.

    Useful for cross-negotiation analysis or training data generation.

    Args:
        negotiation_ids: List of negotiation UUIDs

    Returns:
        Dictionary mapping negotiation_id to its playbook data

    Example:
        >>> ids = ["123e4567-...", "234e5678-..."]
        >>> data = get_multiple_negotiations_playbook_data(ids)
        >>> for neg_id, runs in data.items():
        ...     print(f"Negotiation {neg_id}: {len(runs)} runs")
    """
    result = {}
    for neg_id in negotiation_ids:
        try:
            result[neg_id] = get_negotiation_playbook_data(neg_id)
        except Exception as e:
            logger.error(f"Error fetching playbook data for negotiation {neg_id}: {e}")
            result[neg_id] = []

    return result


# CLI interface for testing and manual usage
if __name__ == "__main__":
    import argparse
    from dotenv import load_dotenv

    # Load environment variables
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

    # Configure logging for CLI usage
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    )

    parser = argparse.ArgumentParser(
        description='Generate negotiation playbook data as JSON'
    )
    parser.add_argument(
        '--negotiation-id',
        required=True,
        help='UUID of the negotiation'
    )
    parser.add_argument(
        '--compact',
        action='store_true',
        help='Output compact JSON (no indentation)'
    )
    parser.add_argument(
        '--output',
        help='Output file path (default: print to stdout)'
    )

    args = parser.parse_args()

    try:
        # Generate playbook data
        json_output = get_negotiation_playbook_json(
            args.negotiation_id,
            pretty=not args.compact
        )

        # Output to file or stdout
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            logger.info(f"Playbook data written to {args.output}")
        else:
            print(json_output)

    except Exception as e:
        logger.error(f"Error generating playbook: {e}")
        sys.exit(1)
