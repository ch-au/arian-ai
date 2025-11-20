# Prompt Variable Analysis

## Variables Required by Prompts

### Self Prompt Required Variables:
- agent_role, company, role_objectives
- negotiation_title, current_round, max_rounds
- previous_rounds, current_round_message, opponent_last_offer
- negotiation_context, negotiation_frequency, negotiation_type
- intelligence
- counterpart_company, counterpart_known, company_known, counterpart_attitude, counterpart_distance, power_balance, counterpart_description
- inferred_preferences, observed_behaviour
- last_round_beliefs_json, last_round_intentions
- pricing_related_text, dimension_related_text
- dimension_examples
- technique_name, technique_description, technique_application, technique_key_aspects, technique_key_phrases
- tactic_name, tactic_description, tactic_application, tactic_key_aspects, tactic_key_phrases
- product_key_fields, dimension_schema, beliefs_schema

### Opponent Prompt Required Variables:
- agent_role, company, role_objectives
- negotiation_title, current_round, max_rounds
- previous_rounds, current_round_message, opponent_last_offer, self_last_offer
- intelligence
- counterpart_attitude
- negotiation_context, negotiation_frequency, negotiation_type
- counterpart_company, power_balance, counterpart_distance
- inferred_preferences, observed_behaviour
- last_round_beliefs_json, last_round_intentions
- pricing_related_text, dimension_related_text
- dimension_examples
- product_key_fields, dimension_schema, beliefs_schema

## Variables Currently Generated (Static)

### Used by Prompts:
✅ agent_role, company, role_objectives
✅ negotiation_title, negotiation_type, negotiation_frequency
✅ negotiation_context, intelligence
✅ counterpart_company, counterpart_known, company_known, counterpart_attitude, counterpart_distance, power_balance, counterpart_description
✅ pricing_related_text, dimension_related_text
✅ dimension_examples, dimension_schema, beliefs_schema, product_key_fields
✅ technique_name, technique_description, technique_application, technique_key_aspects, technique_key_phrases
✅ tactic_name, tactic_description, tactic_application, tactic_key_aspects, tactic_key_phrases

### NOT Used by Prompts (UNUSED):
❌ role_perspective (duplicate of agent_role)
❌ primary_success_metric
❌ relationship_type
❌ product_description
❌ product_market_description
❌ additional_comments
❌ context_description (duplicate of negotiation_context)
❌ context_market_conditions
❌ context_baseline_values
❌ negotiation_metadata
❌ counterpart_dominance
❌ counterpart_affiliation
❌ products_info
❌ product_name
❌ zielpreis
❌ preisgrenzen
❌ volume
❌ dimension_name, dimension_unit, min_value, max_value, target_value, goal_priorities
❌ dimension_details (duplicate of dimension_related_text)
❌ zopa_boundaries (duplicate of dimension_details)

## Variables Currently Generated (Dynamic)

### Used by Prompts:
✅ current_round, max_rounds
✅ previous_rounds, current_round_message, opponent_last_offer, self_last_offer
✅ last_round_beliefs_json, last_round_intentions
✅ inferred_preferences, observed_behaviour

## Issues Found

1. **Perspective Confusion**: In `_build_dynamic_prompt_variables`, the logic correctly identifies opponent vs self, but we need to verify the perspective is correct for each role.

2. **Unused Static Variables**: Many variables are generated but never used, wasting computation and memory.

3. **Duplicate Variables**: Several variables are duplicates (e.g., context_description = negotiation_context).

4. **Missing Metadata Access**: Some variables access metadata that may not exist in the expected format.

