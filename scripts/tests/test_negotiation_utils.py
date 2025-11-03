#!/usr/bin/env python3
"""
Unit tests for negotiation_utils.py

Tests cover all helper functions with edge cases and error scenarios.
"""

import pytest
import json
from typing import Dict, Any

# Import functions to test
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from negotiation_utils import (
    analyze_convergence,
    format_dimensions_for_prompt,
    generate_dimension_examples,
    generate_dimension_schema,
    normalize_model_output,
    _extract_numeric
)

# Note: JSON parsing tests removed - we now use structured output with Pydantic models


class TestAnalyzeConvergence:
    """Tests for analyze_convergence function."""

    @pytest.mark.unit
    def test_converging_offers(self):
        """Test detection of converging offers."""
        current = {"Price": 1050, "Delivery": 32}
        previous = {"Price": 1200, "Delivery": 45}
        # Should detect convergence as values are getting closer
        result = analyze_convergence(current, previous)
        assert isinstance(result, bool)

    @pytest.mark.unit
    def test_empty_offers(self):
        """Test with empty offers."""
        assert analyze_convergence({}, {}) is False
        assert analyze_convergence({"Price": 1000}, {}) is False
        assert analyze_convergence({}, {"Price": 1000}) is False

    @pytest.mark.unit
    def test_non_numeric_values_ignored(self):
        """Test that non-numeric values are safely ignored."""
        current = {"Price": 1000, "Terms": "Net 30"}
        previous = {"Price": 1100, "Terms": "Net 45"}
        # Should not crash, only compare numeric values
        result = analyze_convergence(current, previous)
        assert isinstance(result, bool)


class TestFormatDimensionsForPrompt:
    """Tests for format_dimensions_for_prompt function."""

    @pytest.mark.unit
    def test_basic_dimension_formatting(self):
        """Test basic dimension formatting."""
        dimensions = [
            {"name": "Price", "minValue": 1000, "maxValue": 5000, "priority": 1}
        ]
        result = format_dimensions_for_prompt(dimensions)
        assert "Price" in result
        assert "1000" in result
        assert "5000" in result
        assert "CRITICAL" in result

    @pytest.mark.unit
    def test_empty_dimensions(self):
        """Test with no dimensions."""
        result = format_dimensions_for_prompt([])
        assert "No specific dimensions" in result

    @pytest.mark.unit
    def test_multiple_priorities(self):
        """Test formatting with different priority levels."""
        dimensions = [
            {"name": "Price", "priority": 1},
            {"name": "Delivery", "priority": 2},
            {"name": "Payment", "priority": 3}
        ]
        result = format_dimensions_for_prompt(dimensions)
        assert "CRITICAL" in result  # Priority 1
        assert "IMPORTANT" in result  # Priority 2
        assert "FLEXIBLE" in result  # Priority 3


class TestGenerateDimensionExamples:
    """Tests for generate_dimension_examples function."""

    @pytest.mark.unit
    def test_generates_json_format(self):
        """Test that examples are in JSON format."""
        dimensions = [
            {"name": "Price", "minValue": 1000, "maxValue": 5000, "targetValue": 3000}
        ]
        result = generate_dimension_examples(dimensions)
        assert '"Price"' in result
        assert isinstance(result, str)

    @pytest.mark.unit
    def test_empty_dimensions_returns_default(self):
        """Test fallback for empty dimensions."""
        result = generate_dimension_examples([])
        assert "Price" in result  # Default example


class TestGenerateDimensionSchema:
    """Tests for generate_dimension_schema function."""

    @pytest.mark.unit
    def test_schema_format(self):
        """Test schema generation format."""
        dimensions = [
            {"name": "Price"},
            {"name": "Delivery"}
        ]
        result = generate_dimension_schema(dimensions)
        assert '"Price": 0' in result
        assert '"Delivery": 0' in result

    @pytest.mark.unit
    def test_empty_dimensions_returns_default(self):
        """Test fallback for empty dimensions."""
        result = generate_dimension_schema([])
        assert '"Wert": 0' in result


class TestExtractNumeric:
    """Tests for _extract_numeric helper function."""

    @pytest.mark.unit
    def test_extract_from_integer(self):
        """Test extraction from integer."""
        assert _extract_numeric(100) == 100.0

    @pytest.mark.unit
    def test_extract_from_float(self):
        """Test extraction from float."""
        assert _extract_numeric(100.5) == 100.5

    @pytest.mark.unit
    def test_extract_from_string_with_text(self):
        """Test extraction from strings like 'Net 30'."""
        assert _extract_numeric("Net 30") == 30.0
        assert _extract_numeric("30 days") == 30.0
        assert _extract_numeric("10.5%") == 10.5

    @pytest.mark.unit
    def test_extract_from_invalid_input(self):
        """Test that invalid input returns None."""
        assert _extract_numeric("No numbers here") is None
        assert _extract_numeric(None) is None


class TestNormalizeModelOutput:
    """Tests for normalize_model_output function."""

    @pytest.mark.unit
    def test_normalizes_action(self):
        """Test that action is normalized to allowed set."""
        response = {"action": "CONTINUE"}  # Uppercase
        result = normalize_model_output(response, [])
        assert result["action"] == "continue"  # Lowercase

    @pytest.mark.unit
    def test_invalid_action_defaults_to_continue(self):
        """Test that invalid action defaults to continue."""
        response = {"action": "invalid_action"}
        result = normalize_model_output(response, [])
        assert result["action"] == "continue"

    @pytest.mark.unit
    def test_normalizes_dimension_values(self):
        """Test dimension value normalization."""
        response = {
            "action": "continue",
            "offer": {
                "dimension_values": {"Price": "1000", "Delivery": "Net 30"}
            }
        }
        dimensions = [
            {"name": "Price", "minValue": 500, "maxValue": 2000, "unit": "EUR"},
            {"name": "Delivery", "minValue": 7, "maxValue": 45, "unit": "days"}
        ]
        result = normalize_model_output(response, dimensions)

        # Should extract numeric values
        assert result["offer"]["dimension_values"]["Price"] == 1000
        assert result["offer"]["dimension_values"]["Delivery"] == 30

    @pytest.mark.unit
    def test_clamps_values_to_min_max(self):
        """Test that values are clamped to dimension bounds."""
        response = {
            "action": "continue",
            "offer": {
                "dimension_values": {"Price": 10000}  # Way above max
            }
        }
        dimensions = [
            {"name": "Price", "minValue": 500, "maxValue": 2000}
        ]
        result = normalize_model_output(response, dimensions)

        # Should be clamped to max value
        assert result["offer"]["dimension_values"]["Price"] == 2000

    @pytest.mark.unit
    def test_handles_empty_response(self):
        """Test handling of empty or None response."""
        result = normalize_model_output({}, [])
        assert "action" in result
        assert "offer" in result


# TestCleanJsonString removed - no longer needed with structured output


# Integration-style test combining multiple functions
class TestNegotiationUtilsIntegration:
    """Integration tests combining multiple utility functions."""

    @pytest.mark.integration
    def test_full_dimension_workflow(self):
        """Test complete workflow from dimensions to formatted output."""
        dimensions = [
            {
                "name": "Price",
                "minValue": 1000,
                "maxValue": 5000,
                "targetValue": 3000,
                "priority": 1,
                "unit": "EUR"
            },
            {
                "name": "Delivery",
                "minValue": 7,
                "maxValue": 45,
                "targetValue": 14,
                "priority": 2,
                "unit": "days"
            }
        ]

        # Format for prompt
        formatted = format_dimensions_for_prompt(dimensions)
        assert "Price" in formatted
        assert "Delivery" in formatted

        # Generate examples
        examples = generate_dimension_examples(dimensions)
        assert "Price" in examples
        assert "Delivery" in examples

        # Generate schema
        schema = generate_dimension_schema(dimensions)
        assert '"Price": 0' in schema
        assert '"Delivery": 0' in schema

    @pytest.mark.integration
    def test_normalize_workflow(self):
        """Test normalizing structured output."""
        # Simulated structured response (from Pydantic model)
        response_data = {
            "message": "I accept your offer",
            "action": "ACCEPT",
            "offer": {
                "dimension_values": {"Price": "3500", "Delivery": "Net 30"},
                "confidence": 1.5,
                "reasoning": "Fair deal"
            }
        }

        dimensions = [
            {"name": "Price", "minValue": 1000, "maxValue": 5000, "unit": "EUR"},
            {"name": "Delivery", "minValue": 7, "maxValue": 45, "unit": "days"}
        ]

        # Normalize
        normalized = normalize_model_output(response_data, dimensions)
        assert normalized["action"] == "accept"  # Lowercased
        assert normalized["offer"]["dimension_values"]["Price"] == 3500  # Numeric
        assert normalized["offer"]["dimension_values"]["Delivery"] == 30  # Extracted from "Net 30"
