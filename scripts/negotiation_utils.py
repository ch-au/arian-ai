#!/usr/bin/env python3
"""
Negotiation Utility Functions

This file contains helper functions for the negotiation service.
Each function has a clear, single purpose and good documentation.
"""

import json
import os
import re
import base64
import sys
from typing import Dict, Any, List, Optional
try:
    from .negotiation_models import NegotiationConfig
except ImportError:
    from negotiation_models import NegotiationConfig


def safe_json_parse(raw_output: str) -> Dict[str, Any]:
    """
    Parse JSON response from OpenAI agent with comprehensive error handling.
    
    This is the most common failure point, so it has multiple fallback strategies:
    1. Try parsing as direct JSON
    2. Extract JSON from markdown code blocks (```json```)
    3. Clean common JSON formatting issues
    4. Return a safe fallback response if all else fails
    
    Args:
        raw_output: Raw string response from the agent
        
    Returns:
        Dict containing the parsed response or a safe fallback
        
    Example:
        >>> response = safe_json_parse('{"message": "Hello",}')  # trailing comma
        >>> print(response['message'])
        Hello
        
        >>> response = safe_json_parse('```json\n{"action": "continue"}\n```')
        >>> print(response['action'])
        continue
    """
    try:
        # Step 1: Try direct JSON parsing
        if raw_output.strip().startswith('{'):
            cleaned_json = _clean_json_string(raw_output.strip())
            return json.loads(cleaned_json)
        
        # Step 2: Extract from markdown code blocks
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_output, re.DOTALL)
        if json_match:
            cleaned_json = _clean_json_string(json_match.group(1))
            return json.loads(cleaned_json)
        
        # Step 3: Fallback - return a safe response structure
        print(f"WARNING: Could not parse JSON from agent response: {raw_output[:200]}...", file=sys.stderr)
        return _get_fallback_response(raw_output, "Failed to parse structured response")
        
    except json.JSONDecodeError as e:
        print(f"WARNING: JSON parse error: {e}", file=sys.stderr)
        return _get_fallback_response(raw_output, f"JSON parse error: {e}")


def _clean_json_string(json_str: str) -> str:
    """
    Clean up common JSON formatting issues that break parsing.
    
    Fixes:
    - Trailing commas before closing braces/brackets
    - Trailing commas at end of lines
    
    Args:
        json_str: JSON string that might have formatting issues
        
    Returns:
        Cleaned JSON string
    """
    # Remove trailing commas before closing braces/brackets
    json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
    
    # Remove trailing commas at end of lines
    json_str = re.sub(r',(\s*\n\s*[}\]])', r'\1', json_str)
    
    return json_str


def _get_fallback_response(raw_output: str, error_reason: str) -> Dict[str, Any]:
    """
    Create a safe fallback response when JSON parsing fails.
    
    This ensures the system never crashes due to parsing issues.
    """
    return {
        "message": raw_output[:200] + "..." if len(raw_output) > 200 else raw_output,
        "action": "continue",
        "offer": {
            "dimension_values": {}, 
            "confidence": 0.5, 
            "reasoning": "Parse failed"
        },
        "internal_analysis": error_reason,
        "batna_assessment": 0.5,
        "walk_away_threshold": 0.3
    }


def analyze_convergence(current_offer: Dict[str, Any], previous_offer: Dict[str, Any]) -> bool:
    """
    Analyze if negotiation offers are getting closer (converging).
    
    This helps decide if we should extend the negotiation beyond the normal limit
    because the parties are making progress.
    
    Args:
        current_offer: Latest offer dimensions
        previous_offer: Previous round's offer dimensions
        
    Returns:
        True if offers show convergence patterns
        
    Example:
        >>> current = {"Price": 1000, "Delivery": 30}
        >>> previous = {"Price": 1200, "Delivery": 45}
        >>> if analyze_convergence(current, previous):
        ...     print("Parties are getting closer!")
    """
    if not current_offer or not previous_offer:
        return False
    
    convergence_count = 0
    comparable_count = 0
    
    # Compare numeric dimensions that exist in both offers
    for dimension, current_val in current_offer.items():
        if dimension in previous_offer:
            prev_val = previous_offer[dimension]
            
            # Only analyze numeric values
            try:
                current_num = float(current_val)
                prev_num = float(prev_val)
                comparable_count += 1
                
                # Check if values are getting closer
                difference_reduced = abs(current_num - prev_num) < abs(prev_num * NegotiationConfig.CONVERGENCE_THRESHOLD)
                if difference_reduced:
                    convergence_count += 1
                    
            except (ValueError, TypeError):
                # Skip non-numeric values
                continue
    
    # Consider converging if enough dimensions show convergence
    if comparable_count == 0:
        return False
        
    convergence_ratio = convergence_count / comparable_count
    return convergence_ratio >= NegotiationConfig.MIN_CONVERGENCE_RATIO


def format_dimensions_for_prompt(dimensions: List[Dict[str, Any]]) -> str:
    """
    Format negotiation dimensions into human-readable text for AI prompts.
    
    Takes the raw dimension data and converts it into clear instructions
    that the AI agents can understand.
    
    Args:
        dimensions: List of dimension dictionaries from the database
        
    Returns:
        Formatted string for inclusion in AI prompt
        
    Example:
        >>> dims = [{"name": "Price", "minValue": 1000, "maxValue": 5000, "priority": 1}]
        >>> formatted = format_dimensions_for_prompt(dims)
        >>> print(formatted)
        • Price: Range 1000-5000, Target: not specified, Priority: CRITICAL
    """
    if not dimensions:
        return "No specific dimensions defined"
    
    formatted_lines = []
    for dim in dimensions:
        name = dim.get('name', 'Dimension')
        min_val = _safe_float_convert(dim.get('minValue', dim.get('min', 0)))
        max_val = _safe_float_convert(dim.get('maxValue', dim.get('max', 100)))
        target = dim.get('targetValue', 'not specified')
        priority = dim.get('priority', 3)
        unit = dim.get('unit', '')
        
        priority_text = {1: "CRITICAL", 2: "IMPORTANT", 3: "FLEXIBLE"}.get(priority, "FLEXIBLE")
        unit_text = f' {unit}' if unit else ''
        
        formatted_lines.append(
            f"• {name}: Range {min_val}-{max_val}{unit_text}, Target: {target}, Priority: {priority_text}"
        )
    
    return '\n'.join(formatted_lines)


def generate_dimension_examples(dimensions: List[Dict[str, Any]]) -> str:
    """
    Generate realistic example values for negotiation dimensions.
    
    Creates JSON-formatted examples that agents can use as templates
    for their offers.
    
    Args:
        dimensions: List of dimension dictionaries
        
    Returns:
        JSON-formatted string with example values
        
    Example:
        >>> dims = [{"name": "Price", "minValue": 1000, "maxValue": 5000, "targetValue": 3000}]
        >>> examples = generate_dimension_examples(dims)
        >>> print(examples)
        "Price": 3300
    """
    if not dimensions:
        return '"Price": 12000, "Volume": 14, "Delivery": 14, "Payment_Terms": "Net 30"'
    
    examples = []
    for dim in dimensions:
        name = dim.get('name', 'Dimension')
        min_val = _safe_float_convert(dim.get('minValue', dim.get('min', 0)))
        max_val = _safe_float_convert(dim.get('maxValue', dim.get('max', 100)))
        target = _safe_float_convert(dim.get('targetValue', (min_val + max_val) / 2))
        unit = dim.get('unit', '')
        
        # Generate example value (slightly off target for negotiation realism)
        example_val = target + (max_val - min_val) * 0.1
        
        # Format based on unit type
        formatted_value = _format_example_value(example_val, unit)
        examples.append(f'"{name}": {formatted_value}')
    
    return ', '.join(examples)


def _safe_float_convert(value: Any) -> float:
    """Safely convert a value to float with fallback."""
    try:
        return float(value) if value is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def _format_example_value(value: float, unit: str) -> str:
    """Format an example value based on its unit type."""
    unit_lower = unit.lower() if unit else ''
    
    # Currency formats
    if unit_lower in ['usd', 'eur', 'gbp', 'currency', '$', '€', '£']:
        return str(int(value))
    
    # Time formats  
    elif unit_lower in ['days', 'months', 'years', 'weeks']:
        return str(int(value))
    
    # Percentage formats
    elif unit_lower in ['%', 'percent', 'percentage']:
        return str(round(value, 1))
    
    # Payment terms
    elif 'net' in unit_lower:
        return f'"Net {int(value)}"'
    
    # Default numeric format
    else:
        return str(int(value)) if value > 1000 else str(round(value, 2))


def setup_langfuse_tracing() -> bool:
    """
    Setup OpenTelemetry tracing to send data to Langfuse.
    
    This enables detailed monitoring of AI agent interactions.
    If setup fails, the service continues without tracing.
    
    Returns:
        True if tracing was configured successfully, False otherwise
        
    Note:
        Requires LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables.
    """
    try:
        public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
        secret_key = os.getenv("LANGFUSE_SECRET_KEY")
        host = os.getenv("LANGFUSE_HOST", NegotiationConfig.LANGFUSE_DEFAULT_HOST)
        
        if not public_key or not secret_key:
            print("DEBUG: Langfuse credentials not found, skipping tracing setup", file=sys.stderr)
            return False
        
        # Create authentication header for OTLP endpoint
        auth_string = f"{public_key}:{secret_key}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        # Configure OpenTelemetry endpoint
        otlp_endpoint = f"{host}/api/public/v2/otlp/traces"
        os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = otlp_endpoint
        os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {auth_b64}"
        
        # Configure and initialize logfire
        import logfire
        logfire.configure(
            service_name='negotiation_agent_service',
            send_to_logfire=False,  # Only send to Langfuse
            trace_sample_rate=1.0,
        )
        logfire.instrument_openai_agents()
        
        print(f"DEBUG: OpenTelemetry tracing configured for Langfuse at {host}", file=sys.stderr)
        return True
        
    except Exception as e:
        print(f"DEBUG: OpenTelemetry setup failed (continuing without tracing): {e}", file=sys.stderr)
        return False


def calculate_dynamic_max_rounds(base_rounds: int, dimensions: List[Dict]) -> int:
    """
    Calculate maximum rounds based on negotiation complexity.
    
    More dimensions = more complexity = more rounds needed.
    
    Args:
        base_rounds: Base number of rounds requested
        dimensions: List of negotiation dimensions
        
    Returns:
        Adjusted maximum rounds (capped at ABSOLUTE_MAX_ROUNDS)
        
    Example:
        >>> max_rounds = calculate_dynamic_max_rounds(6, [dim1, dim2, dim3])
        >>> # Returns something like 8 for 3 dimensions
    """
    dimension_count = len(dimensions) if dimensions else 1
    complexity_factor = max(1.0, dimension_count * NegotiationConfig.COMPLEXITY_MULTIPLIER)
    adjusted_rounds = int(base_rounds * complexity_factor)
    
    return min(adjusted_rounds, NegotiationConfig.ABSOLUTE_MAX_ROUNDS)


def emit_round_update(round_num: int, role: str, response_data: Dict[str, Any]) -> None:
    """
    Emit a real-time update for the Node.js service to broadcast.
    
    This allows the frontend to show live negotiation progress.
    
    Args:
        round_num: Current round number
        role: Agent role (BUYER or SELLER)
        response_data: Agent's response data
        
    Note:
        Outputs to stdout with special prefix that Node.js watches for.
    """
    try:
        round_update = {
            "round": round_num,
            "agent": role,
            "message": response_data.get('message', ''),
            "offer": response_data.get('offer', {}),
            "action": response_data.get('action', 'continue')
        }
        # Special prefix for Node.js to capture
        print(f"ROUND_UPDATE:{json.dumps(round_update)}", flush=True)
        
    except Exception as e:
        print(f"DEBUG: Failed to emit round update: {e}", file=sys.stderr)
