# Configuration Field Usage Analysis

This document analyzes which fields collected in the configuration form are **actually used** in the AI negotiation workflow.

---

## Summary

| Usage Category | Count | Fields |
|---|---|---|
| ✅ **Critical** (used in LLM prompts) | 16 | Products, dimensions, techniques, tactics, counterpart, market intelligence, etc. |
| ⚠️ **Contextual** (provide context but not critical) | 8 | relationshipType, negotiationFrequency, companyKnown, etc. |
| ❌ **Unused** (stored but not consumed) | 3 | goalMargin, brand, category |
| 🔄 **Metadata** (tracking/display only) | 4 | title, description, country, region |

---

## Field-by-Field Analysis

### 🟢 Company Step

#### ✅ `organization` - **USED**
- **Stored in:** `registrations.organization`
- **Used in prompt:** `'company'` variable → LLM knows which company is negotiating
- **Location:** [run_production_negotiation.py:451-452](scripts/run_production_negotiation.py:451-452)
```python
'company': registration.get('company') or registration.get('organization')
```
**Verdict:** ✅ **Keep** - Critical for agent identity

---

#### 🔄 `company` (brand name) - **METADATA**
- **Stored in:** `registrations.company`
- **Used in prompt:** Falls back to this if organization not set
- **Usage:** Display/tracking, secondary to organization
**Verdict:** ⚠️ **Optional** - Nice to have for display but not critical

---

#### 🔄 `country` - **METADATA**
- **Stored in:** `registrations.country`
- **Used in prompt:** ❌ Not directly used
- **Usage:** Stored for reference, displayed in UI
**Verdict:** 🔄 **Metadata only** - Good for reporting/filtering but doesn't affect negotiation

---

#### ⚠️ `negotiationType` - **CONTEXTUAL**
- **Stored in:** `registrations.negotiationType`
- **Used in prompt:** ✅ `'negotiation_type'` variable
- **Location:** [run_production_negotiation.py:457](scripts/run_production_negotiation.py:457)
```python
'negotiation_type': context.get('negotiationType') or registration.get('negotiationType') or 'one-shot'
```
**Usage:** Informs LLM about negotiation style (e.g., "Jahresgespräch" → annual negotiation)
**Verdict:** ⚠️ **Contextual** - Helps LLM understand context but not critical to outcomes

---

#### ⚠️ `relationshipType` - **CONTEXTUAL**
- **Stored in:** `negotiations.scenario.relationshipType`
- **Used in prompt:** ✅ `'relationship_type'` variable
- **Location:** [run_production_negotiation.py:458](scripts/run_production_negotiation.py:458)
```python
'relationship_type': context.get('relationshipType') or 'unbekannt'
```
**Usage:** Tells LLM if this is "strategisch" (strategic) vs casual relationship
**Impact:** Influences agent tone and concession willingness
**Verdict:** ⚠️ **Contextual** - Affects negotiation style but not critical

---

#### ⚠️ `negotiationFrequency` - **CONTEXTUAL**
- **Stored in:** `registrations.negotiationFrequency`
- **Used in prompt:** ✅ `'negotiation_frequency'` variable
- **Location:** [run_production_negotiation.py:459](scripts/run_production_negotiation.py:459)
```python
'negotiation_frequency': context.get('negotiationFrequency') or registration.get('negotiationFrequency') or 'unbekannt'
```
**Usage:** Tells LLM if this is "jährlich" (yearly), "quarterly", etc.
**Impact:** Influences urgency and long-term relationship considerations
**Verdict:** ⚠️ **Contextual** - Nice context but not critical

---

#### ❌ `goalMargin` - **UNUSED**
- **Stored in:** `registrations.goals.margin`
- **Used in prompt:** ❌ **NOT USED AT ALL**
- **Location:** Stored at [CreateNegotiationForm.tsx:189](client/src/components/CreateNegotiationForm.tsx:189) but never retrieved in Python
**Verdict:** ❌ **REMOVE** - Currently useless. If you want to use it:
  - Add to prompt: `'goal_margin': registration.get('goals', {}).get('margin')`
  - Use it to calculate performance scores in analysis

---

#### 🔄 `description` - **METADATA**
- **Stored in:** `negotiations.description`
- **Used in prompt:** ⚠️ Used as fallback for `product_description`
- **Location:** [run_production_negotiation.py:460](scripts/run_production_negotiation.py:460)
```python
'product_description': context.get('productMarketDescription') or negotiation.get('description', 'Business transaction')
```
**Verdict:** 🔄 **Keep** - Good for display and fallback context

---

### 🟢 Market Step

#### ✅ `name` - **USED**
- **Stored in:** `markets.name`
- **Used in prompt:** ✅ `'negotiation_context'` via `_summarize_negotiation_context`
- **Location:** [run_production_negotiation.py:679](scripts/run_production_negotiation.py:679)
```python
if market.get('name'):
    summary.append(f"Markt: {market.get('name')} ({market.get('countryCode', '')})")
```
**Verdict:** ✅ **Keep** - Provides market context

---

#### 🔄 `region` - **METADATA**
- **Stored in:** `markets.region`
- **Used in prompt:** ❌ Not directly used
**Verdict:** 🔄 **Optional** - Good for filtering/reporting but not critical

---

#### ✅ `countryCode` - **USED**
- **Stored in:** `markets.countryCode`
- **Used in prompt:** ✅ Part of market context (see above)
**Verdict:** ✅ **Keep** - Market context

---

#### ✅ `currencyCode` - **USED**
- **Stored in:** `markets.currencyCode`
- **Used in prompt:** ❌ Not directly in prompt but **critical for price formatting**
- **Usage:** Determines how prices are displayed (EUR, USD, etc.)
**Verdict:** ✅ **Keep** - Critical for internationalization

---

#### ✅ `intelligence` (market insights) - **USED**
- **Stored in:** `markets.meta.intelligence`
- **Used in prompt:** ✅ `'intelligence'` variable
- **Location:** [run_production_negotiation.py:656-666](scripts/run_production_negotiation.py:656-666)
```python
def _resolve_market_intel(self, market, context):
    meta = market.get('meta') if isinstance(market.get('meta'), dict) else {}
    for candidate in [
        meta.get('analysis'),
        meta.get('intelligence'),
        context.get('marketIntelligence'),
        context.get('intelligence'),
    ]:
        if candidate:
            return str(candidate)
    return "Keine Marktdaten verfügbar."
```
**Verdict:** ✅ **CRITICAL** - Provides strategic context to agents

---

#### 🔄 `notes` - **METADATA**
- **Stored in:** `markets.meta.notes`
- **Used in prompt:** ❌ Not directly used
**Verdict:** 🔄 **Optional** - Good for internal notes but doesn't affect negotiation

---

### 🟢 Counterpart Step

#### ✅ `name` - **USED**
- **Stored in:** `counterparts.name`
- **Used in prompt:** ✅ `'counterpart_company'` variable
- **Location:** [run_production_negotiation.py:480](scripts/run_production_negotiation.py:480)
```python
'counterpart_company': counterpart.get('name', 'Unbekannt')
```
**Verdict:** ✅ **CRITICAL** - Agent needs to know who they're negotiating with

---

#### ✅ `kind` - **USED**
- **Stored in:** `counterparts.kind` (enum: retailer/manufacturer/distributor/other)
- **Used in prompt:** ✅ Part of `'counterpart_description'`
- **Location:** [run_production_negotiation.py:545-554](scripts/run_production_negotiation.py:545-554)
```python
def _describe_counterpart(self, counterpart):
    parts = [
        counterpart.get('name'),
        counterpart.get('kind'),  # <- Used here
        f"Stil: {counterpart.get('style')}" if counterpart.get('style') else None,
        f"Notizen: {counterpart.get('notes')}" if counterpart.get('notes') else None,
    ]
    return " | ".join([p for p in parts if p])
```
**Verdict:** ✅ **Keep** - Helps agent understand counterpart type

---

#### ✅ `powerBalance` - **USED**
- **Stored in:** `counterparts.powerBalance` (0-100)
- **Used in prompt:** ✅ `'power_balance'` variable
- **Location:** [run_production_negotiation.py:485](scripts/run_production_negotiation.py:485)
```python
'power_balance': str(counterpart.get('powerBalance') or context.get('powerBalance') or 'unbekannt')
```
**Verdict:** ✅ **CRITICAL** - Affects agent strategy (aggressive vs defensive)

---

#### ✅ `style` - **USED**
- **Stored in:** `counterparts.style`
- **Used in prompt:** ✅ `'counterpart_attitude'` variable
- **Location:** [run_production_negotiation.py:483](scripts/run_production_negotiation.py:483)
```python
'counterpart_attitude': counterpart.get('style', 'neutral')
```
**Verdict:** ✅ **CRITICAL** - Shapes opponent agent personality

---

#### 🔄 `notes` - **METADATA**
- **Stored in:** `counterparts.notes`
- **Used in prompt:** ✅ Part of `'counterpart_description'` (see above)
**Verdict:** ⚠️ **Optional but useful** - Provides extra context

---

### 🟢 Products Step

#### ✅ `name` - **USED**
- **Stored in:** `products.name`
- **Used in prompt:** ✅ Multiple places (product lists, pricing strings)
- **Location:** [run_production_negotiation.py:577-589](scripts/run_production_negotiation.py:577-589)
**Verdict:** ✅ **CRITICAL** - Core to product-based negotiations

---

#### ❌ `brand` - **UNUSED**
- **Stored in:** `products.brand`
- **Used in prompt:** ❌ **NOT USED**
- **Used in results:** ❌ Not used in analysis
**Verdict:** ❌ **REMOVE** - Currently just stored but never consumed

---

#### ❌ `category` - **UNUSED**
- **Stored in:** `products.categoryPath`
- **Used in prompt:** ❌ **NOT USED**
**Verdict:** ❌ **REMOVE** - Not used in negotiation logic

---

#### ✅ `targetPrice` - **USED**
- **Stored in:** `products.attrs.targetPrice`
- **Used in prompt:** ✅ `'zielpreis'` variable
- **Used in results:** ✅ `product_results.targetPrice`
**Verdict:** ✅ **CRITICAL** - Core negotiation parameter

---

#### ✅ `minPrice` - **USED**
- **Stored in:** `products.attrs.minPrice`
- **Used in prompt:** ✅ Part of `'maxpreis'` (role-dependent)
- **Used in results:** ✅ ZOPA calculations
**Verdict:** ✅ **CRITICAL** - Defines seller's walk-away point

---

#### ✅ `maxPrice` - **USED**
- **Stored in:** `products.attrs.maxPrice`
- **Used in prompt:** ✅ Part of `'maxpreis'` (role-dependent)
- **Used in results:** ✅ ZOPA calculations
**Verdict:** ✅ **CRITICAL** - Defines buyer's walk-away point

---

#### ✅ `estimatedVolume` - **USED**
- **Stored in:** `products.attrs.estimatedVolume`
- **Used in prompt:** ✅ `'volume'` variable
- **Used in results:** ✅ Deal value calculation (`agreedPrice × volume`)
**Verdict:** ✅ **CRITICAL** - Required for deal value calculation

---

### 🟢 Dimensions Step

#### ✅ `name` - **USED**
- **Used in prompt:** ✅ `'dimension_name'`, `'dimension_schema'`
- **Used in results:** ✅ Matching LLM output to configured dimensions
**Verdict:** ✅ **CRITICAL** - Core to multi-dimensional negotiations

---

#### ✅ `unit` - **USED**
- **Used in prompt:** ✅ `'dimension_unit'`
- **Used in results:** ✅ Display formatting
**Verdict:** ✅ **Keep** - Important for clarity

---

#### ✅ `minValue`, `maxValue`, `targetValue` - **USED**
- **Used in prompt:** ✅ ZOPA boundaries, target goals
- **Used in results:** ✅ `dimension_results` achievement calculations
**Verdict:** ✅ **CRITICAL** - Define negotiation space

---

#### ✅ `priority` (1-3) - **USED**
- **Used in prompt:** ✅ `'goal_priorities'`
- **Used in results:** ✅ `dimension_results.priorityScore`
**Verdict:** ✅ **CRITICAL** - Guides agent trade-off decisions

---

### 🟢 Strategy Step

#### ✅ `userRole` (buyer/seller) - **USED**
- **Used in prompt:** ✅ `'agent_role'`, determines which agent is "self"
- **Location:** [run_production_negotiation.py:449](scripts/run_production_negotiation.py:449)
**Verdict:** ✅ **CRITICAL** - Defines simulation perspective

---

#### ✅ `maxRounds` - **USED**
- **Used in prompt:** ✅ `'max_rounds'` variable
- **Used in execution:** ✅ Termination condition
**Verdict:** ✅ **CRITICAL** - Controls simulation length

---

#### ✅ `selectedTechniques` - **USED**
- **Stored in:** `negotiations.scenario.selectedTechniques[]`
- **Used in simulation:** ✅ `simulation_runs.techniqueId` → fetches technique details
- **Used in prompt:** ✅ Full technique data (name, beschreibung, anwendung, wichtigeAspekte, keyPhrases)
- **Location:** [run_production_negotiation.py:509-513](scripts/run_production_negotiation.py:509-513)
**Verdict:** ✅ **CRITICAL** - Core to strategy variation

---

#### ✅ `selectedTactics` - **USED**
- **Stored in:** `negotiations.scenario.selectedTactics[]`
- **Used in simulation:** ✅ `simulation_runs.tacticId` → fetches tactic details
- **Used in prompt:** ✅ Full tactic data
- **Location:** [run_production_negotiation.py:514-518](scripts/run_production_negotiation.py:514-518)
**Verdict:** ✅ **CRITICAL** - Core to strategy variation

---

#### ✅ `productMarketDescription` - **USED**
- **Stored in:** `negotiations.scenario.productMarketDescription`
- **Used in prompt:** ✅ `'product_description'`, `'product_market_description'`
- **Location:** [run_production_negotiation.py:460-461](scripts/run_production_negotiation.py:460-461)
**Verdict:** ✅ **Keep** - Provides rich context

---

#### ⚠️ `additionalComments` - **CONTEXTUAL**
- **Stored in:** `negotiations.scenario.additionalComments`
- **Used in prompt:** ✅ `'additional_comments'`
- **Location:** [run_production_negotiation.py:462](scripts/run_production_negotiation.py:462)
**Verdict:** ⚠️ **Optional but useful** - Free-form context

---

#### ⚠️ `sonderinteressen` - **CONTEXTUAL**
- **Stored in:** `negotiations.scenario.sonderinteressen`
- **Used in prompt:** ❓ Not explicitly mapped to a variable in the code snippet I reviewed
**Verdict:** ⚠️ **Potentially unused** - Check if prompt templates use this

---

#### ⚠️ `companyKnown` - **CONTEXTUAL**
- **Stored in:** `negotiations.scenario.metadata.companyKnown`
- **Used in prompt:** ✅ `'company_known'` (formatted as "Ja"/"Nein")
- **Location:** [run_production_negotiation.py:482](scripts/run_production_negotiation.py:482)
**Impact:** Could influence opponent's knowledge assumptions
**Verdict:** ⚠️ **Keep** - Useful context flag

---

#### ⚠️ `counterpartKnown` - **CONTEXTUAL**
- **Stored in:** `negotiations.scenario.metadata.counterpartKnown`
- **Used in prompt:** ✅ `'counterpart_known'`
- **Location:** [run_production_negotiation.py:481](scripts/run_production_negotiation.py:481)
**Verdict:** ⚠️ **Keep** - Affects relationship dynamics

---

#### ⚠️ `counterpartDistance` - **CONTEXTUAL**
- **Stored in:** `negotiations.scenario.counterpartDistance.gesamt` (0-100%)
- **Used in prompt:** ✅ `'counterpart_distance'` (as JSON)
- **Location:** [run_production_negotiation.py:484](scripts/run_production_negotiation.py:484)
**Impact:** Indicates how far apart initial positions are
**Verdict:** ⚠️ **Keep** - Shapes opponent starting position

---

## Recommendations by Priority

### ❌ Remove (Not Used)
1. **`goalMargin`** (company step)
   - Currently stored but never used in prompts or analysis
   - **Action:** Either remove from form OR add to prompt + use in effectiveness scoring

2. **`brand`** (products step)
   - Stored but not used in negotiation logic or analysis
   - **Action:** Remove from form (unless you plan to use for product categorization)

3. **`category`** (products step)
   - Same as brand
   - **Action:** Remove from form

### ⚠️ Simplify (Low Impact)
4. **`relationshipType`** (company step)
   - Used in prompt but low impact on outcomes
   - **Consider:** Merge with `counterpartKnown` (if known → "long-standing", else "first")

5. **`negotiationFrequency`** (company step)
   - Contextual but not critical
   - **Consider:** Make optional or use default based on `negotiationType`

6. **`region`** (market step)
   - Not used in prompts
   - **Consider:** Make optional or remove

### ✅ Keep (Critical)
All other fields are actively used in prompts or result calculations.

---

## Proposed Simplified Form

If you want to streamline the form, here's a minimal set:

### Step 1: Company & Market
- Organization ✅
- Country (for display) 🔄
- Market name ✅
- Currency code ✅
- Market intelligence ✅

### Step 2: Counterpart
- Name ✅
- Type (retailer/etc.) ✅
- Power balance ✅
- Style ✅

### Step 3: Products
- Name ✅
- Target price ✅
- Min/max price ✅
- Estimated volume ✅

### Step 4: Dimensions (Alternative to Products)
- Name, unit ✅
- Min/max/target values ✅
- Priority ✅

### Step 5: Strategy
- Your role (buyer/seller) ✅
- Max rounds ✅
- Select techniques ✅
- Select tactics ✅
- Context description (optional) ⚠️

This reduces from **~30 fields** to **~20 core fields** without losing any critical functionality.

---

## Impact on Data Model

If you remove these fields:

### No Schema Changes Needed
- `brand`, `category` → Already in `products.attrs` JSONB (can just ignore)
- `goalMargin` → Already in `registrations.goals` JSONB (can ignore)

### Optional: Cleanup
```sql
-- If you want to clean up unused fields:
UPDATE products SET attrs = attrs - 'brand' - 'category';
UPDATE registrations SET goals = goals - 'margin';
```

But since they're in JSONB, you can simply stop collecting them in the form and they'll naturally disappear from new records.
