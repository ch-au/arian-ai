# Price Confidentiality - Opponent Agent Implementation

## 🎯 Problem

The opponent agent was receiving the **user's real target prices** in the desires section, which is unrealistic and gives the opponent unfair advantage. In real negotiations, the opponent doesn't know your exact target prices.

## ✅ Solution

Target prices are now **dynamically adjusted** for the opponent agent based on `counterpartDistance`, reflecting uncertainty and strategic positioning.

---

## 📐 Formula

```python
distance = counterpartDistance['gesamt']  # 0-100 scale
deviation_factor = (distance / 100) * MAX_PRICE_DEVIATION  # MAX = 30%

if opponent_role == "BUYER":
    adjusted_price = own_target_price * (1 - deviation_factor)
elif opponent_role == "SELLER":
    adjusted_price = own_target_price * (1 + deviation_factor)
```

### Logic:
- **Opponent is BUYER** (wants lower prices) → Adjust target **DOWN**
- **Opponent is SELLER** (wants higher prices) → Adjust target **UP**
- **Distance = 0** → No deviation (opponent sees real target)
- **Distance = 100** → Max deviation (30% difference)

---

## 📊 Examples

### Example 1: User = SELLER, Opponent = BUYER

**Config:**
```json
{
  "counterpart": {
    "kind": "retailer",  // BUYER
    "counterpartDistance": {"gesamt": 80}
  },
  "products": [
    {
      "name": "Milka 100g",
      "zielPreis": 1.20  // User's real target
    }
  ]
}
```

**Calculation:**
```
distance = 80
deviation_factor = (80 / 100) * 0.30 = 0.24 (24%)
opponent_role = BUYER → adjust DOWN
adjusted_price = 1.20 * (1 - 0.24) = 1.20 * 0.76 = 0.912 EUR
```

**Result:**
- **USER (SELLER)** sees: `Zielpreis: 1.20 EUR` ✅ Real target
- **OPPONENT (BUYER)** sees: `Zielpreis: 0.91 EUR` ✅ Adjusted lower

### Example 2: User = BUYER, Opponent = SELLER

**Config:**
```json
{
  "counterpart": {
    "kind": "manufacturer",  // SELLER
    "counterpartDistance": {"gesamt": 50}
  },
  "products": [
    {
      "name": "Component XYZ",
      "zielPreis": 10.00  // User's real target
    }
  ]
}
```

**Calculation:**
```
distance = 50
deviation_factor = (50 / 100) * 0.30 = 0.15 (15%)
opponent_role = SELLER → adjust UP
adjusted_price = 10.00 * (1 + 0.15) = 10.00 * 1.15 = 11.50 EUR
```

**Result:**
- **USER (BUYER)** sees: `Zielpreis: 10.00 EUR` ✅ Real target
- **OPPONENT (SELLER)** sees: `Zielpreis: 11.50 EUR` ✅ Adjusted higher

### Example 3: Distance = 0 (Perfect alignment)

**Config:**
```json
{
  "counterpart": {
    "kind": "retailer",  // BUYER
    "counterpartDistance": {"gesamt": 0}
  },
  "products": [
    {
      "name": "Milka 100g",
      "zielPreis": 1.20
    }
  ]
}
```

**Calculation:**
```
distance = 0
deviation_factor = (0 / 100) * 0.30 = 0.00 (0%)
adjusted_price = 1.20 * (1 - 0.00) = 1.20 EUR
```

**Result:**
- **USER** sees: `Zielpreis: 1.20 EUR`
- **OPPONENT** sees: `Zielpreis: 1.20 EUR` ✅ Same (perfect alignment!)

---

## 🔧 Implementation Details

### Configuration

```python
# At top of run_production_negotiation.py
MAX_PRICE_DEVIATION = 0.30  # 30% max deviation at distance=100
```

### Method: `_calculate_opponent_target_price()`

**Location:** `scripts/run_production_negotiation.py`, lines ~658-713

**Parameters:**
- `own_target_price`: User's real target price
- `counterpart_distance_data`: Distance data (dict or float), 0-100 scale
- `opponent_role`: "BUYER" or "SELLER"
- `max_deviation`: Maximum deviation (default 30%)

**Returns:** Adjusted target price for opponent

**Features:**
- ✅ Handles dict format: `{"gesamt": 80}` or `{"preis": 70, "qualität": 90}`
- ✅ Handles float format: `80.0`
- ✅ Clamps distance to 0-100 range
- ✅ Debug logging for transparency

### Updated Methods

All pricing-related methods now accept `use_self_prompt` and `counterpart` parameters:

#### 1. `_build_pricing_strings()` (lines ~715-766)
```python
def _build_pricing_strings(
    self,
    products: List[Dict[str, Any]],
    role: str,
    use_self_prompt: bool = True,  # NEW
    counterpart: Dict[str, Any] = None  # NEW
) -> Dict[str, str]:
```

**Variables returned:**
- `namen`: Product names
- `zielpreise`: Target prices (ADJUSTED for opponent!)
- `maxpreise`: Max/min prices (guards)
- `volumes`: Estimated volumes

#### 2. `_format_pricing_related_text()` (lines ~767-816)
```python
def _format_pricing_related_text(
    self,
    products: List[Dict[str, Any]],
    role: str,
    use_self_prompt: bool = True,  # NEW
    counterpart: Dict[str, Any] = None  # NEW
) -> str:
```

**Used for:** Formatted pricing blocks in prompts

#### 3. `_format_products_for_prompt()` (lines ~1003-1045)
```python
def _format_products_for_prompt(
    self,
    products: List[Dict],
    role: str,
    use_self_prompt: bool = True,  # NEW
    counterpart: Dict[str, Any] = None  # NEW
) -> str:
```

**Used for:** Product info summaries

### Call Sites

All calls in `_build_static_prompt_variables()` updated:

```python
# Lines ~488-493
pricing_strings = self._build_pricing_strings(products, role, use_self_prompt, counterpart)
pricing_related_text = self._format_pricing_related_text(products, role, use_self_prompt, counterpart)
products_info = self._format_products_for_prompt(products, role, use_self_prompt, counterpart)
```

---

## 🔍 How It Works

### Flow for USER Agent (use_self_prompt=True)

```
1. _create_agents() determines roles
2. _build_static_prompt_variables(role=SELLER, use_self_prompt=True)
3. _build_pricing_strings(role=SELLER, use_self_prompt=True)
4. → Skips adjustment (use_self_prompt=True)
5. → Returns REAL target prices
6. USER agent sees: "Zielpreis: 1.20 EUR"
```

### Flow for OPPONENT Agent (use_self_prompt=False)

```
1. _create_agents() determines roles
2. _build_static_prompt_variables(role=BUYER, use_self_prompt=False, counterpart={...})
3. _build_pricing_strings(role=BUYER, use_self_prompt=False, counterpart={...})
4. → Triggers adjustment (use_self_prompt=False)
5. → Calls _calculate_opponent_target_price()
6. → Returns ADJUSTED target prices
7. OPPONENT agent sees: "Zielpreis: 0.91 EUR"
```

---

## 📈 Impact

### Before Implementation:
```
USER (SELLER) prompt:
- Zielpreis: 1.20 EUR  ✅ Correct

OPPONENT (BUYER) prompt:
- Zielpreis: 1.20 EUR  ❌ Sees real target! Unfair advantage!
```

### After Implementation:
```
USER (SELLER) prompt:
- Zielpreis: 1.20 EUR  ✅ Correct

OPPONENT (BUYER) prompt:
- Zielpreis: 0.91 EUR  ✅ Adjusted based on distance=80!
```

---

## 🎓 Best Practices

### DO:
✅ Use `counterpartDistance` to configure negotiation difficulty
✅ Higher distance = more uncertainty = larger price gap
✅ Test with different distances (0, 50, 100) to verify behavior
✅ Check debug logs to see price adjustments

### DON'T:
❌ Set distance > 100 (will be clamped)
❌ Assume opponent sees real targets (they don't!)
❌ Forget to configure `counterpartDistance` in negotiation data

---

## 🐛 Debug Logging

The implementation logs all price adjustments:

```bash
# Check logs for price adjustments
grep "Opponent target price" stderr
```

**Example output:**
```
Opponent target price: 1.20 → 0.91 (distance=80.0, deviation=24.00%, role=BUYER)
Opponent target price: 10.00 → 11.50 (distance=50.0, deviation=15.00%, role=SELLER)
```

---

## 🧪 Testing

### Test Case 1: High Distance (Difficult Negotiation)
```json
{
  "counterpartDistance": {"gesamt": 100},
  "products": [{"name": "Test", "zielPreis": 10.00}]
}
```

**Expected (Opponent=BUYER):** `adjusted = 10.00 * 0.70 = 7.00 EUR` (30% lower)
**Expected (Opponent=SELLER):** `adjusted = 10.00 * 1.30 = 13.00 EUR` (30% higher)

### Test Case 2: Medium Distance
```json
{
  "counterpartDistance": {"gesamt": 50},
  "products": [{"name": "Test", "zielPreis": 10.00}]
}
```

**Expected (Opponent=BUYER):** `adjusted = 10.00 * 0.85 = 8.50 EUR` (15% lower)
**Expected (Opponent=SELLER):** `adjusted = 10.00 * 1.15 = 11.50 EUR` (15% higher)

### Test Case 3: Low Distance (Easy Negotiation)
```json
{
  "counterpartDistance": {"gesamt": 20},
  "products": [{"name": "Test", "zielPreis": 10.00}]
}
```

**Expected (Opponent=BUYER):** `adjusted = 10.00 * 0.94 = 9.40 EUR` (6% lower)
**Expected (Opponent=SELLER):** `adjusted = 10.00 * 1.06 = 10.60 EUR` (6% higher)

---

## 📝 Configuration Options

### Adjust Maximum Deviation

Edit `MAX_PRICE_DEVIATION` at top of file:

```python
# Default: 30% max deviation
MAX_PRICE_DEVIATION = 0.30

# Conservative: 20% max deviation
MAX_PRICE_DEVIATION = 0.20

# Aggressive: 50% max deviation
MAX_PRICE_DEVIATION = 0.50
```

### Distance Data Format

Supports multiple formats:

**Dict with 'gesamt':**
```json
{"gesamt": 80}
```

**Dict with dimension keys:**
```json
{"preis": 70, "qualität": 90}  // Uses first value (70)
```

**Float:**
```json
80.0
```

---

## ✅ Status

- ✅ **`_calculate_opponent_target_price()` implemented**
- ✅ **`_build_pricing_strings()` updated**
- ✅ **`_format_pricing_related_text()` updated**
- ✅ **`_format_products_for_prompt()` updated**
- ✅ **All call sites updated in `_build_static_prompt_variables()`**
- ✅ **Debug logging added**
- ✅ **Syntax validated**
- ✅ **Documented**

---

## 🚀 Next Steps

1. **Test Implementation:**
   ```bash
   python scripts/run_production_negotiation.py \
     --negotiation-id=test-price-conf \
     --simulation-run-id=sim-001 \
     --max-rounds=3 \
     --negotiation-data='{"counterpart": {"kind": "retailer", "counterpartDistance": {"gesamt": 80}}, ...}'
   ```

2. **Verify Logs:**
   ```bash
   grep "Opponent target price" stderr
   grep "ROLE ASSIGNMENT" stderr
   ```

3. **Check Trace in Langfuse:**
   - Verify USER agent sees real prices
   - Verify OPPONENT agent sees adjusted prices
   - Compare negotiation outcomes with different distances

---

**Impact:** Opponent agents now have realistic uncertainty about user's target prices, making negotiations more realistic and strategically interesting! 🎉
