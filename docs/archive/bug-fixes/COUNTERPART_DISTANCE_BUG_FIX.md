# Counterpart Distance Bug Fix

## 🐛 Problem

The opponent agent was seeing the user's **real target prices** instead of adjusted prices based on `counterpartDistance`. This made negotiations unrealistic because the opponent knew exactly what the user wanted to pay/receive.

### Root Cause

In [CreateNegotiationForm.tsx:257](client/src/components/CreateNegotiationForm.tsx#L257), the `counterpartDistance` field had two issues:

1. **Wrong default value**: Default was `0` instead of `50`
2. **Duplicate field**: Also added to `counterpartProfile` (line 277) with default `50`, creating inconsistency

```typescript
// BEFORE (BUGGY):
const scenario = {
  // ...
  counterpartDistance: { gesamt: values.strategy.counterpartDistance ?? 0 },  // ❌ Default 0
  // ...
  counterpartProfile: {
    // ...
    counterpartDistance: { gesamt: values.strategy.counterpartDistance ?? 50 },  // ❌ Duplicate + Default 50
  },
};
```

### Impact

When `counterpartDistance` was `0` or missing:
- Python code: `context.get('counterpartDistance')` returned `{'gesamt': 0}`
- Distance calculation: `distance = 0.0`
- Deviation factor: `0.0 * 0.30 = 0%`
- **Result**: Opponent saw REAL prices (no adjustment)

## ✅ Solution

Fixed [CreateNegotiationForm.tsx:257](client/src/components/CreateNegotiationForm.tsx#L257):

```typescript
// AFTER (FIXED):
const scenario = {
  // ...
  counterpartDistance: { gesamt: values.strategy.counterpartDistance ?? 50 },  // ✅ Default 50
  // ...
  counterpartProfile: {
    // ... (removed counterpartDistance from here - not needed)
  },
};
```

### Changes Made

1. ✅ Changed default value from `0` to `50` in line 257
2. ✅ Removed duplicate `counterpartDistance` from `counterpartProfile` (line 277)
3. ✅ Now consistent: single source of truth at `scenario.counterpartDistance`

## 🔍 Data Flow Verification

### Frontend → Backend → Python

**1. Frontend (CreateNegotiationForm.tsx:257)**
```typescript
scenario: {
  counterpartDistance: { gesamt: 50 },  // ← Set here
  // ...
}
```

**2. Backend Storage (server/routes/negotiations.ts:165)**
```typescript
scenario: payload.scenario  // ← Stored in negotiations.scenario (JSONB column)
```

**3. Backend → Python (server/services/python-negotiation-service.ts:370-378)**
```typescript
return {
  context: negotiation.scenario,  // ← context.counterpartDistance = { gesamt: 50 }
  // ...
};
```

**4. Python Script (scripts/run_production_negotiation.py:454,556)**
```python
context = self.negotiation_data.get('context', {})  # ← From backend
counterpart_distance = context.get('counterpartDistance')  # ← { 'gesamt': 50 }
```

**5. Price Adjustment (scripts/run_production_negotiation.py:758-806)**
```python
distance_data = counterpart.get('counterpartDistance') or context.get('counterpartDistance')
# → { 'gesamt': 50 }

adjusted_price = self._calculate_opponent_target_price(
    own_target_price=1.10,
    counterpart_distance_data=distance_data,  # { 'gesamt': 50 }
    opponent_role='BUYER'
)
# → Result: 1.10 * (1 - 0.15) = 0.935 EUR (15% lower)
```

## 📊 Expected Behavior (After Fix)

### Example: User=SELLER, Opponent=BUYER, Distance=50

**User's Target**: 1.10 EUR

**Calculation**:
```
distance = 50
deviation_factor = (50 / 100) * 0.30 = 0.15 (15%)
opponent_role = BUYER → adjust DOWN
adjusted_price = 1.10 * (1 - 0.15) = 0.935 EUR
```

**Result**:
- ✅ **USER** sees: `Zielpreis: 1.10 EUR`
- ✅ **OPPONENT** sees: `Zielpreis: 0.94 EUR` (15% lower)

### Example: Distance=80

**Calculation**:
```
distance = 80
deviation_factor = (80 / 100) * 0.30 = 0.24 (24%)
adjusted_price = 1.10 * (1 - 0.24) = 0.836 EUR
```

**Result**:
- ✅ **USER** sees: `Zielpreis: 1.10 EUR`
- ✅ **OPPONENT** sees: `Zielpreis: 0.84 EUR` (24% lower)

## 🧪 Testing

### Test Script

Created [scripts/test_price_adjustment.py](scripts/test_price_adjustment.py) to validate formula:

```bash
python3 scripts/test_price_adjustment.py
```

**Results**: ✅ ALL TESTS PASSED

- Distance=0 → 0% deviation (prices match)
- Distance=50 → 15% deviation
- Distance=80 → 24% deviation
- Distance=100 → 30% deviation (max)

### Integration Test

**Before testing**:
1. Restart `npm run dev` to apply frontend changes
2. Create a NEW negotiation (existing ones still have old data)
3. Set `counterpartDistance` slider or accept default (50)

**Verification**:
```bash
# Check debug logs when running negotiation
grep "counterpartDistance" server-logs
grep "Opponent target price" server-logs
```

**Expected logs**:
```
counterpartDistance: {'gesamt': 50}
Opponent target price: 1.10 → 0.94 (distance=50.0, deviation=15.00%, role=BUYER)
```

## 📝 Key Files Modified

| File | Lines | Change |
|------|-------|--------|
| [client/src/components/CreateNegotiationForm.tsx](client/src/components/CreateNegotiationForm.tsx) | 257 | Changed default `0` → `50` |
| [client/src/components/CreateNegotiationForm.tsx](client/src/components/CreateNegotiationForm.tsx) | 277 | Removed duplicate `counterpartDistance` |

## ⚠️ Important Notes

### For Existing Negotiations

Negotiations created **before this fix** will still have:
- `scenario.counterpartDistance = { gesamt: 0 }` (old default)

**Options**:
1. **Create new negotiations** (recommended) - will have correct default
2. **Update database** manually for important existing negotiations
3. **Accept limitation** - old negotiations won't have price adjustment

### Database Migration (Optional)

To fix existing negotiations:

```sql
-- Set default distance=50 for negotiations with distance=0
UPDATE negotiations
SET scenario = jsonb_set(
  scenario,
  '{counterpartDistance,gesamt}',
  '50'
)
WHERE scenario->'counterpartDistance'->>'gesamt' = '0';
```

## ✅ Status

- ✅ Bug identified and root cause found
- ✅ Frontend fix applied (default value + remove duplicate)
- ✅ Data flow verified (Frontend → Backend → Python)
- ✅ Price adjustment formula tested and working
- ✅ Debug logging in place
- ⚠️ **Requires**: Restart `npm run dev` and create NEW negotiation to test

## 🚀 Next Steps

1. **Deploy**: Restart `npm run dev`
2. **Test**: Create new negotiation with default distance (50)
3. **Verify**: Check Langfuse trace that opponent sees adjusted prices
4. **Confirm**: User reports opponent desires show correct values

---

**Impact**: Negotiations will now be realistic with opponents having uncertainty about user's target prices! 🎉
