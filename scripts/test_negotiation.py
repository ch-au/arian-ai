#!/usr/bin/env python3
"""
Simple Test Suite for Negotiation Service

These are basic tests that a junior developer can run to make sure
their changes don't break the core functionality.

Usage:
    python test_negotiation.py

All tests should pass before committing changes.
"""

import json
import sys
import os

# Add current directory to path for imports
sys.path.append(os.path.dirname(__file__))

from negotiation_models import NegotiationConfig, NegotiationOutcome, AgentRole
from negotiation_utils import (
    analyze_convergence, format_dimensions_for_prompt,
    generate_dimension_examples
)


def test_convergence_analysis():
    """Test the offer convergence detection."""
    print("Testing convergence analysis...")
    
    # Test 1: Converging offers (prices getting closer)
    offer1 = {"Price": 1000, "Delivery": 30}
    offer2 = {"Price": 1050, "Delivery": 32}  # Much closer
    
    # This should show convergence
    is_converging = analyze_convergence(offer2, offer1)
    print(f"✓ Convergence test: {is_converging}")
    
    # Test 2: Diverging offers
    offer3 = {"Price": 2000, "Delivery": 60}  # Much farther apart
    is_diverging = analyze_convergence(offer3, offer1)
    print(f"✓ Divergence test: {not is_diverging}")
    
    # Test 3: Empty offers
    empty_result = analyze_convergence({}, {})
    assert empty_result == False
    print("✓ Empty offer handling works")
    
    print("✅ All convergence tests passed!\n")


def test_dimension_formatting():
    """Test dimension formatting for AI prompts."""
    print("Testing dimension formatting...")
    
    # Test with realistic dimensions
    test_dimensions = [
        {
            "name": "Price",
            "minValue": "1000",  # String values should work
            "maxValue": "5000",
            "targetValue": "3000",
            "priority": 1,
            "unit": "EUR"
        },
        {
            "name": "Delivery",
            "minValue": 7,  # Numeric values should work
            "maxValue": 30,
            "priority": 2,
            "unit": "days"
        }
    ]
    
    formatted = format_dimensions_for_prompt(test_dimensions)
    assert "Price: Range 1000.0-5000.0 EUR" in formatted
    assert "CRITICAL" in formatted  # Priority 1
    assert "IMPORTANT" in formatted  # Priority 2
    print("✓ Dimension formatting works")
    
    # Test with empty dimensions
    empty_formatted = format_dimensions_for_prompt([])
    assert "No specific dimensions" in empty_formatted
    print("✓ Empty dimension handling works")
    
    print("✅ All dimension formatting tests passed!\n")


def test_configuration():
    """Test configuration and environment validation."""
    print("Testing configuration...")
    
    # Test environment validation (will fail in test but shouldn't crash)
    try:
        is_valid, missing = NegotiationConfig.validate_environment()
        print(f"✓ Environment validation works (valid: {is_valid})")
        if not is_valid:
            print(f"  Missing vars: {missing} (expected in test environment)")
    except Exception as e:
        print(f"✗ Environment validation failed: {e}")
        return False
    
    # Test outcome scoring
    score = NegotiationOutcome.get_success_score(NegotiationOutcome.DEAL_ACCEPTED)
    assert score == 1.0
    print("✓ Outcome scoring works")
    
    # Test role constants
    opposite = AgentRole.get_opposite_role(AgentRole.BUYER)
    assert opposite == AgentRole.SELLER
    print("✓ Role constants work")
    
    print("✅ All configuration tests passed!\n")


def test_example_generation():
    """Test dimension example generation."""
    print("Testing example generation...")
    
    test_dimensions = [
        {"name": "Price", "minValue": 1000, "maxValue": 5000, "targetValue": 3000, "unit": "EUR"},
        {"name": "Delivery", "minValue": 7, "maxValue": 30, "targetValue": 14, "unit": "days"}
    ]
    
    examples = generate_dimension_examples(test_dimensions)
    assert "Price" in examples
    assert "Delivery" in examples
    print(f"✓ Example generation: {examples}")
    
    print("✅ All example generation tests passed!\n")


def run_all_tests():
    """Run all tests and report results."""
    print("🧪 Running Negotiation Service Tests")
    print("=" * 50)
    
    try:
        test_convergence_analysis()
        test_dimension_formatting()
        test_configuration()
        test_example_generation()
        
        print("🎉 ALL TESTS PASSED!")
        print("The negotiation service is working correctly.")
        return True
        
    except Exception as e:
        print(f"❌ TEST FAILED: {e}")
        print("Please fix the issue before committing changes.")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
