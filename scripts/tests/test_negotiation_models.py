#!/usr/bin/env python3
"""
Unit tests for negotiation_models.py

Tests cover Pydantic models, configuration, and data validation.
"""

import pytest
import os
from pydantic import ValidationError

# Import models to test
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from negotiation_models import (
    NegotiationOffer,
    NegotiationResponse,
    NegotiationConfig,
    NegotiationOutcome,
    AgentRole
)


class TestNegotiationOffer:
    """Tests for NegotiationOffer Pydantic model."""

    @pytest.mark.unit
    def test_valid_offer(self):
        """Test creating a valid offer."""
        offer = NegotiationOffer(
            dimension_values={"Price": 1000, "Delivery": 30},
            confidence=0.85,
            reasoning="Fair price based on market conditions"
        )
        assert offer.dimension_values["Price"] == 1000
        assert offer.confidence == 0.85
        assert isinstance(offer.reasoning, str)

    @pytest.mark.unit
    def test_confidence_validation_lower_bound(self):
        """Test that confidence must be >= 0."""
        with pytest.raises(ValidationError):
            NegotiationOffer(
                dimension_values={},
                confidence=-0.1,  # Invalid: below 0
                reasoning="Test"
            )

    @pytest.mark.unit
    def test_confidence_validation_upper_bound(self):
        """Test that confidence must be <= 1."""
        with pytest.raises(ValidationError):
            NegotiationOffer(
                dimension_values={},
                confidence=1.5,  # Invalid: above 1
                reasoning="Test"
            )

    @pytest.mark.unit
    def test_confidence_boundary_values(self):
        """Test confidence at exact boundaries."""
        # Should accept 0.0
        offer1 = NegotiationOffer(
            dimension_values={},
            confidence=0.0,
            reasoning="Test"
        )
        assert offer1.confidence == 0.0

        # Should accept 1.0
        offer2 = NegotiationOffer(
            dimension_values={},
            confidence=1.0,
            reasoning="Test"
        )
        assert offer2.confidence == 1.0


class TestNegotiationResponse:
    """Tests for NegotiationResponse Pydantic model."""

    @pytest.mark.unit
    def test_valid_response(self):
        """Test creating a valid negotiation response."""
        response = NegotiationResponse(
            message="I propose a price of €1000",
            action="continue",
            offer=NegotiationOffer(
                dimension_values={"Price": 1000},
                confidence=0.8,
                reasoning="Market rate"
            ),
            internal_analysis="They seem eager to close",
            batna_assessment=0.6,
            walk_away_threshold=0.3
        )
        assert response.action == "continue"
        assert response.message == "I propose a price of €1000"
        assert response.offer.dimension_values["Price"] == 1000

    @pytest.mark.unit
    def test_action_literal_validation(self):
        """Test that action must be one of the allowed values."""
        valid_actions = ["continue", "accept", "terminate", "walk_away", "pause"]

        # All valid actions should work
        for action in valid_actions:
            response = NegotiationResponse(
                message="Test",
                action=action,
                offer=NegotiationOffer(
                    dimension_values={},
                    confidence=0.5,
                    reasoning="Test"
                ),
                internal_analysis="Test"
            )
            assert response.action == action

    @pytest.mark.unit
    def test_default_values(self):
        """Test that default values are properly set."""
        response = NegotiationResponse(
            message="Test",
            action="continue",
            offer=NegotiationOffer(
                dimension_values={},
                confidence=0.5,
                reasoning="Test"
            ),
            internal_analysis="Test"
        )
        # These have defaults
        assert response.batna_assessment == 0.5
        assert response.walk_away_threshold == 0.3


class TestNegotiationConfig:
    """Tests for NegotiationConfig class."""

    @pytest.mark.unit
    def test_default_values(self):
        """Test that config has sensible defaults."""
        assert NegotiationConfig.DEFAULT_MODEL == "gpt-5"
        assert NegotiationConfig.DEFAULT_TEMPERATURE == 0.7
        assert NegotiationConfig.DEFAULT_MAX_TOKENS == 20000
        assert NegotiationConfig.DEFAULT_MAX_ROUNDS == 6
        assert NegotiationConfig.ABSOLUTE_MAX_ROUNDS == 20

    @pytest.mark.unit
    def test_convergence_thresholds(self):
        """Test convergence detection thresholds."""
        assert 0.0 < NegotiationConfig.CONVERGENCE_THRESHOLD < 1.0
        assert 0.0 < NegotiationConfig.MIN_CONVERGENCE_RATIO <= 1.0

    @pytest.mark.unit
    def test_environment_validation_success(self, monkeypatch):
        """Test environment validation with all variables set."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-key")
        monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "test-pub")
        monkeypatch.setenv("LANGFUSE_SECRET_KEY", "test-secret")

        is_valid, missing = NegotiationConfig.validate_environment()
        assert is_valid is True
        assert len(missing) == 0

    @pytest.mark.unit
    def test_environment_validation_failure(self, monkeypatch):
        """Test environment validation with missing variables."""
        # Clear all relevant environment variables
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
        monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)

        is_valid, missing = NegotiationConfig.validate_environment()
        assert is_valid is False
        assert "OPENAI_API_KEY" in missing
        assert "LANGFUSE_PUBLIC_KEY" in missing
        assert "LANGFUSE_SECRET_KEY" in missing


class TestNegotiationOutcome:
    """Tests for NegotiationOutcome constants and methods."""

    @pytest.mark.unit
    def test_outcome_constants(self):
        """Test that all outcome constants are defined."""
        assert NegotiationOutcome.DEAL_ACCEPTED == "DEAL_ACCEPTED"
        assert NegotiationOutcome.TERMINATED == "TERMINATED"
        assert NegotiationOutcome.WALK_AWAY == "WALK_AWAY"
        assert NegotiationOutcome.PAUSED == "PAUSED"
        assert NegotiationOutcome.MAX_ROUNDS_REACHED == "MAX_ROUNDS_REACHED"
        assert NegotiationOutcome.ERROR == "ERROR"

    @pytest.mark.unit
    def test_success_scores(self):
        """Test success score mappings."""
        assert NegotiationOutcome.SUCCESS_SCORES["DEAL_ACCEPTED"] == 1.0
        assert NegotiationOutcome.SUCCESS_SCORES["ERROR"] == 0.0
        assert 0.0 <= NegotiationOutcome.SUCCESS_SCORES["WALK_AWAY"] <= 1.0

    @pytest.mark.unit
    def test_get_success_score(self):
        """Test success score retrieval."""
        assert NegotiationOutcome.get_success_score("DEAL_ACCEPTED") == 1.0
        assert NegotiationOutcome.get_success_score("ERROR") == 0.0

    @pytest.mark.unit
    def test_get_success_score_unknown_outcome(self):
        """Test default score for unknown outcomes."""
        score = NegotiationOutcome.get_success_score("UNKNOWN_OUTCOME")
        assert score == 0.2  # Default fallback


class TestAgentRole:
    """Tests for AgentRole constants and methods."""

    @pytest.mark.unit
    def test_role_constants(self):
        """Test that role constants are defined."""
        assert AgentRole.BUYER == "BUYER"
        assert AgentRole.SELLER == "SELLER"

    @pytest.mark.unit
    def test_get_opposite_role(self):
        """Test role switching logic."""
        assert AgentRole.get_opposite_role(AgentRole.BUYER) == AgentRole.SELLER
        assert AgentRole.get_opposite_role(AgentRole.SELLER) == AgentRole.BUYER

    @pytest.mark.unit
    def test_get_opposite_role_case_sensitive(self):
        """Test that role switching handles exact values."""
        assert AgentRole.get_opposite_role("BUYER") == "SELLER"
        assert AgentRole.get_opposite_role("SELLER") == "BUYER"


# Integration tests
class TestModelIntegration:
    """Integration tests for model interactions."""

    @pytest.mark.integration
    def test_full_negotiation_response_cycle(self):
        """Test creating a complete negotiation response."""
        # Create an offer
        offer = NegotiationOffer(
            dimension_values={
                "Price": 3500,
                "Delivery": 30,
                "Payment_Terms": 45
            },
            confidence=0.75,
            reasoning="Balanced offer considering market conditions and our BATNA"
        )

        # Create a response
        response = NegotiationResponse(
            message="Based on current market conditions, I propose €3,500 with 30-day delivery.",
            action="continue",
            offer=offer,
            internal_analysis="Counterpart seems flexible on payment terms but firm on price. May need to compromise on delivery timeline.",
            batna_assessment=0.65,
            walk_away_threshold=0.35
        )

        # Validate the complete structure
        assert response.action in ["continue", "accept", "terminate", "walk_away", "pause"]
        assert 0.0 <= response.offer.confidence <= 1.0
        assert 0.0 <= response.batna_assessment <= 1.0
        assert 0.0 <= response.walk_away_threshold <= 1.0
        assert isinstance(response.message, str)
        assert len(response.message) > 0

    @pytest.mark.integration
    def test_model_serialization(self):
        """Test that models can be serialized to dict."""
        response = NegotiationResponse(
            message="Test",
            action="accept",
            offer=NegotiationOffer(
                dimension_values={"Price": 1000},
                confidence=0.9,
                reasoning="Good deal"
            ),
            internal_analysis="Will accept"
        )

        # Convert to dict
        data = response.model_dump()
        assert isinstance(data, dict)
        assert data["action"] == "accept"
        assert data["offer"]["dimension_values"]["Price"] == 1000
