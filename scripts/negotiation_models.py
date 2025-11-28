#!/usr/bin/env python3
"""
Negotiation Data Models and Schemas

This file contains all the data structures used in the negotiation service.
A junior developer can look here to understand what data flows through the system.
"""

import os
from typing import Dict, Any, Literal, Optional, List
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings


class NegotiationOffer(BaseModel):
    """
    Represents a negotiation offer from an agent.
    
    This is what gets exchanged between buyer and seller during negotiations.
    """
    dimension_values: Dict[str, Any] = Field(
        description="Offer values for each negotiation dimension (e.g., {'Price': 1000, 'Delivery': 30})"
    )
    confidence: float = Field(
        description="How confident the agent is in this offer (0.0 = not confident, 1.0 = very confident)", 
        ge=0.0, le=1.0
    )
    reasoning: str = Field(
        description="Why the agent made this offer"
    )


class NegotiationResponse(BaseModel):
    """
    Complete response from an agent during negotiation.

    This is the main data structure that agents return each round.
    """
    message: str = Field(
        description="The public message sent to the other party"
    )
    action: Literal["continue", "accept", "terminate", "walk_away", "pause"] = Field(
        description="What the agent wants to do next"
    )
    offer: NegotiationOffer = Field(
        description="The agent's current offer"
    )
    internal_analysis: str = Field(
        description="Private thoughts - not shared with the other party"
    )
    batna_assessment: float = Field(
        description="How good are our alternatives? (0.0 = terrible, 1.0 = excellent)",
        default=0.5, ge=0.0, le=1.0
    )
    walk_away_threshold: float = Field(
        description="Below this score, we should walk away (typically 0.2-0.4)",
        default=0.3, ge=0.0, le=1.0
    )


class SimulationEvaluation(BaseModel):
    """
    AI-generated evaluation of a completed simulation run.

    Based on Langfuse prompt 'simulation_eval'.
    Uses structured output to analyze technique/tactic effectiveness.
    """
    tactical_summary: str = Field(
        description="2-3 Sätze zu den Haupterkenntnissen in der Verhandlung mit Blick auf Taktik / Einfluss / Gesprächsführung"
    )
    influencing_effectiveness_score: int = Field(
        ge=1, le=10,
        description="Bewertung der Influence Technique Effektivität (1-10)"
    )
    tactic_effectiveness_score: int = Field(
        ge=1, le=10,
        description="Bewertung der Verhandlungstaktik Effektivität (1-10)"
    )


class NegotiationConfig:
    """
    Configuration settings for the negotiation service.
    
    All settings in one place so they're easy to find and modify.
    """
    # Model settings
    DEFAULT_MODEL: str = "gpt-5"
    DEFAULT_TEMPERATURE: float = 0.7
    DEFAULT_MAX_TOKENS: int = 20000
    
    # Negotiation limits
    DEFAULT_MAX_ROUNDS: int = 6
    ABSOLUTE_MAX_ROUNDS: int = 20
    COMPLEXITY_MULTIPLIER: float = 0.25  # Extra rounds per dimension
    
    # Convergence detection
    CONVERGENCE_THRESHOLD: float = 0.1  # 10% difference threshold
    MIN_CONVERGENCE_RATIO: float = 0.5  # 50% of dimensions must converge
    
    # Langfuse settings
    LANGFUSE_DEFAULT_HOST: str = "https://cloud.langfuse.com"
    LANGFUSE_FLUSH_INTERVAL: float = 0.5
    LANGFUSE_MAX_RETRIES: int = 3
    LANGFUSE_TIMEOUT: int = 30

    # LLM timeout settings (in seconds)
    LLM_REQUEST_TIMEOUT: int = 120  # 2 minutes per LLM call
    
    @classmethod
    def validate_environment(cls) -> tuple[bool, list[str]]:
        """
        Check if all required environment variables are set.
        
        Returns:
            (is_valid, missing_vars): True if all vars present, list of missing vars
            
        Example:
            >>> is_valid, missing = NegotiationConfig.validate_environment()
            >>> if not is_valid:
            ...     print(f"Missing: {missing}")
        """
        import os
        
        required_vars = [
            "OPENAI_API_KEY", 
            "LANGFUSE_PUBLIC_KEY", 
            "LANGFUSE_SECRET_KEY"
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        return len(missing_vars) == 0, missing_vars


class NegotiationOutcome:
    """
    Possible negotiation outcomes and their success scores.
    
    Used to determine how successful a negotiation was.
    """
    DEAL_ACCEPTED = "DEAL_ACCEPTED"
    TERMINATED = "TERMINATED"
    WALK_AWAY = "WALK_AWAY"
    PAUSED = "PAUSED"
    MAX_ROUNDS_REACHED = "MAX_ROUNDS_REACHED"
    ERROR = "ERROR"
    
    SUCCESS_SCORES = {
        DEAL_ACCEPTED: 1.0,        # Perfect success
        TERMINATED: 0.6,           # Polite ending
        WALK_AWAY: 0.4,           # BATNA decision
        PAUSED: 0.5,              # Partial progress
        MAX_ROUNDS_REACHED: 0.3,   # Time limit
        ERROR: 0.0                # Technical failure
    }
    
    @classmethod
    def get_success_score(cls, outcome: str) -> float:
        """Get the success score for an outcome."""
        return cls.SUCCESS_SCORES.get(outcome, 0.2)


class AgentRole:
    """Constants for agent roles to avoid typos."""
    BUYER = "BUYER"
    SELLER = "SELLER"
    
    @classmethod
    def get_opposite_role(cls, role: str) -> str:
        """Get the opposite role (BUYER -> SELLER, SELLER -> BUYER)."""
        return cls.SELLER if role == cls.BUYER else cls.BUYER
