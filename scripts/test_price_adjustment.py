#!/usr/bin/env python3
"""
Test script to verify price adjustment logic works correctly.
"""

import sys
import json

# Mock the NegotiationService class methods we need
class MockNegotiationService:
    def __init__(self):
        self.MAX_PRICE_DEVIATION = 0.30

    def _calculate_opponent_target_price(
        self,
        own_target_price: float,
        counterpart_distance_data,
        opponent_role: str,
        max_deviation: float = 0.30
    ) -> float:
        """Calculate opponent's perceived target price based on distance."""
        # Extract distance value
        if isinstance(counterpart_distance_data, dict):
            distance = float(counterpart_distance_data.get('gesamt', 0))
            if distance == 0 and counterpart_distance_data:
                distance = float(next(iter(counterpart_distance_data.values()), 0))
        else:
            try:
                distance = float(counterpart_distance_data or 0)
            except (ValueError, TypeError):
                distance = 0.0

        # Clamp distance to 0-100
        distance = max(0.0, min(distance, 100.0))

        # Calculate deviation factor
        deviation_factor = (distance / 100.0) * max_deviation

        # Apply deviation based on opponent's role
        if opponent_role.upper() == "BUYER":
            adjusted_price = own_target_price * (1 - deviation_factor)
        elif opponent_role.upper() == "SELLER":
            adjusted_price = own_target_price * (1 + deviation_factor)
        else:
            print(f"⚠️  Unknown opponent_role '{opponent_role}', using own_target_price")
            adjusted_price = own_target_price

        print(f"   Opponent target price: {own_target_price:.2f} → {adjusted_price:.2f} "
              f"(distance={distance:.1f}, deviation={deviation_factor:.2%}, role={opponent_role})")

        return adjusted_price


def test_price_adjustment():
    """Test various scenarios of price adjustment."""
    service = MockNegotiationService()

    print("\n" + "="*70)
    print("PRICE ADJUSTMENT TEST")
    print("="*70)

    # Test Case 1: User=SELLER, Opponent=BUYER, Distance=80
    print("\n📊 Test 1: User=SELLER (target: 1.20 EUR), Distance=80, Opponent=BUYER")
    print("-" * 70)
    result1 = service._calculate_opponent_target_price(
        own_target_price=1.20,
        counterpart_distance_data={"gesamt": 80},
        opponent_role="BUYER"
    )
    expected1 = 1.20 * 0.76  # (1 - 0.24)
    assert abs(result1 - expected1) < 0.01, f"Expected {expected1:.2f}, got {result1:.2f}"
    print(f"   ✅ USER sees: Zielpreis: 1.20 EUR")
    print(f"   ✅ OPPONENT sees: Zielpreis: {result1:.2f} EUR (24% lower)")

    # Test Case 2: User=BUYER, Opponent=SELLER, Distance=50
    print("\n📊 Test 2: User=BUYER (target: 10.00 EUR), Distance=50, Opponent=SELLER")
    print("-" * 70)
    result2 = service._calculate_opponent_target_price(
        own_target_price=10.00,
        counterpart_distance_data={"gesamt": 50},
        opponent_role="SELLER"
    )
    expected2 = 10.00 * 1.15  # (1 + 0.15)
    assert abs(result2 - expected2) < 0.01, f"Expected {expected2:.2f}, got {result2:.2f}"
    print(f"   ✅ USER sees: Zielpreis: 10.00 EUR")
    print(f"   ✅ OPPONENT sees: Zielpreis: {result2:.2f} EUR (15% higher)")

    # Test Case 3: Distance=0 (perfect alignment)
    print("\n📊 Test 3: User=SELLER (target: 1.20 EUR), Distance=0, Opponent=BUYER")
    print("-" * 70)
    result3 = service._calculate_opponent_target_price(
        own_target_price=1.20,
        counterpart_distance_data={"gesamt": 0},
        opponent_role="BUYER"
    )
    expected3 = 1.20  # No deviation
    assert abs(result3 - expected3) < 0.01, f"Expected {expected3:.2f}, got {result3:.2f}"
    print(f"   ✅ USER sees: Zielpreis: 1.20 EUR")
    print(f"   ✅ OPPONENT sees: Zielpreis: {result3:.2f} EUR (same - perfect alignment!)")

    # Test Case 4: Distance=100 (maximum deviation)
    print("\n📊 Test 4: User=SELLER (target: 10.00 EUR), Distance=100, Opponent=BUYER")
    print("-" * 70)
    result4 = service._calculate_opponent_target_price(
        own_target_price=10.00,
        counterpart_distance_data={"gesamt": 100},
        opponent_role="BUYER"
    )
    expected4 = 10.00 * 0.70  # (1 - 0.30)
    assert abs(result4 - expected4) < 0.01, f"Expected {expected4:.2f}, got {result4:.2f}"
    print(f"   ✅ USER sees: Zielpreis: 10.00 EUR")
    print(f"   ✅ OPPONENT sees: Zielpreis: {result4:.2f} EUR (30% lower - max deviation!)")

    # Test Case 5: Float distance format
    print("\n📊 Test 5: Distance as float (80.0)")
    print("-" * 70)
    result5 = service._calculate_opponent_target_price(
        own_target_price=5.00,
        counterpart_distance_data=80.0,
        opponent_role="SELLER"
    )
    expected5 = 5.00 * 1.24  # (1 + 0.24)
    assert abs(result5 - expected5) < 0.01, f"Expected {expected5:.2f}, got {result5:.2f}"
    print(f"   ✅ Float distance format works!")

    # Test Case 6: Dict with dimension keys
    print("\n📊 Test 6: Distance as dict with dimension keys")
    print("-" * 70)
    result6 = service._calculate_opponent_target_price(
        own_target_price=8.00,
        counterpart_distance_data={"preis": 60, "qualität": 40},
        opponent_role="BUYER"
    )
    expected6 = 8.00 * 0.82  # Uses first value (60), (1 - 0.18)
    assert abs(result6 - expected6) < 0.01, f"Expected {expected6:.2f}, got {result6:.2f}"
    print(f"   ✅ Dict with dimension keys works (uses first value)!")

    print("\n" + "="*70)
    print("✅ ALL TESTS PASSED!")
    print("="*70)
    print("\n📝 Summary:")
    print("   • Price adjustment formula works correctly")
    print("   • BUYER opponent → prices adjusted DOWN")
    print("   • SELLER opponent → prices adjusted UP")
    print("   • Distance=0 → no adjustment")
    print("   • Distance=100 → maximum 30% deviation")
    print("   • All distance formats supported (dict/float)")
    print()


if __name__ == "__main__":
    test_price_adjustment()
