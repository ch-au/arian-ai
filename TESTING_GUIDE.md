# ARIAN AI - Testing Guide for Phase 1 Improvements

## Overview
This guide demonstrates how to test the critical foundation fixes implemented in Phase 1, specifically the **combinatorial simulation system**.

## What We Fixed

### 1. ✅ CreateNegotiationForm Data Binding
- **Before**: Form fields referenced incorrect paths like `userZopaVolumen.min`
- **After**: Correct paths like `userZopa.volumen.min` matching backend schema

### 2. ✅ Combinatorial Simulation Creation 
- **Before**: Only single negotiations created
- **After**: N×M technique-tactic combinations automatically generated

### 3. ✅ Database Query Layer
- **Before**: Wrong foreign key relationships in rounds queries  
- **After**: Proper simulation run → rounds relationship

### 4. ✅ Cleaned Up Duplicate Routes
- **Before**: Duplicate start/stop endpoints
- **After**: Single clean endpoint set

## Testing Options

### Option 1: API Testing (Recommended for Now)

Test the core functionality without setting up the full database:

```bash
# Test the API structure and validation
cd arian-ai
curl -X POST http://localhost:3000/api/negotiations \
  -H "Content-Type: application/json" \
  -d '{
    "contextId": "550e8400-e29b-41d4-a716-446655440000",
    "buyerAgentId": "550e8400-e29b-41d4-a716-446655440001", 
    "sellerAgentId": "550e8400-e29b-41d4-a716-446655440002",
    "userRole": "buyer",
    "maxRounds": 10,
    "selectedTechniques": ["scarcity", "social_proof", "reciprocity"],
    "selectedTactics": ["competitive_pricing", "value_creation"],
    "userZopa": {
      "volumen": {"min": 100, "max": 1000, "target": 500},
      "preis": {"min": 10, "max": 100, "target": 50},
      "laufzeit": {"min": 12, "max": 36, "target": 24},
      "zahlungskonditionen": {"min": 30, "max": 90, "target": 60}
    },
    "counterpartDistance": {
      "volumen": 0, "preis": 0, "laufzeit": 0, "zahlungskonditionen": 0
    },
    "sonderinteressen": "Sustainability focus"
  }'
```

**Expected Result**: 6 simulation runs created (3 techniques × 2 tactics)

### Option 2: Database Setup for Full Testing

1. **Get a Neon Database URL** (free tier available):
   - Visit https://neon.tech
   - Create a free account
   - Create a new database
   - Copy the connection string

2. **Set Environment Variables**:
```bash
# Create .env file
echo "DATABASE_URL=your_neon_connection_string_here" > .env
echo "OPENAI_API_KEY=your_openai_key_here" >> .env
echo "LANGFUSE_SECRET_KEY=your_langfuse_key_here" >> .env
echo "LANGFUSE_PUBLIC_KEY=your_langfuse_public_key_here" >> .env
echo "LANGFUSE_HOST=https://cloud.langfuse.com" >> .env
```

3. **Run Database Migration**:
```bash
npm run db:push
```

4. **Start the Application**:
```bash
npm run dev
```

### Option 3: Manual Code Review Testing

Review the key changes in the codebase:

#### A. Form Data Binding Fix
Check `client/src/components/CreateNegotiationForm.tsx` lines:
- Line ~462: `form.watch("userZopa.preis")?.min` (Fixed from `userZopaPreis`)
- Line ~520: `form.watch("counterpartDistance.preis")` (Fixed from `counterpartDistancePreis`)

#### B. Combinatorial Logic Implementation  
Check `server/storage.ts` lines:
- Line ~248: `createNegotiationWithSimulationRuns()` method
- Line ~262: N×M combination generation loop
- Line ~264: `for (const techniqueId of techniqueIds)`
- Line ~265: `for (const tacticId of tacticIds)`

#### C. API Response Enhancement
Check `server/routes.ts` lines:
- Line ~346: New response structure with `simulationRuns` array
- Line ~348: `totalCombinations` count returned

## Expected Behavior

### Input: 3 Techniques × 2 Tactics = 6 Simulation Runs

```json
{
  "selectedTechniques": ["scarcity", "social_proof", "reciprocity"],
  "selectedTactics": ["competitive_pricing", "value_creation"]
}
```

### Output: Combinatorial Matrix Created

```json
{
  "negotiation": { "id": "...", "status": "pending" },
  "simulationRuns": [
    {"runNumber": 1, "techniqueId": "scarcity", "tacticId": "competitive_pricing"},
    {"runNumber": 2, "techniqueId": "scarcity", "tacticId": "value_creation"},
    {"runNumber": 3, "techniqueId": "social_proof", "tacticId": "competitive_pricing"},
    {"runNumber": 4, "techniqueId": "social_proof", "tacticId": "value_creation"},
    {"runNumber": 5, "techniqueId": "reciprocity", "tacticId": "competitive_pricing"},
    {"runNumber": 6, "techniqueId": "reciprocity", "tacticId": "value_creation"}
  ],
  "totalCombinations": 6
}
```

## Manual Testing Steps

### 1. Form Field Testing
1. Open developer tools in browser
2. Navigate to the negotiation creation form
3. Fill out form fields
4. Check network tab - form data should use correct field names:
   - ✅ `userZopa.volumen.min` not `userZopaVolumen.min`
   - ✅ `counterpartDistance.preis` not `counterpartDistancePreis`

### 2. Backend Logic Testing
1. Set breakpoints in `createNegotiationWithSimulationRuns()`
2. Submit form with 3 techniques and 2 tactics
3. Verify loop creates 6 simulation runs
4. Check each run has correct `techniqueId` and `tacticId`

### 3. API Response Testing
1. Monitor network response from negotiation creation
2. Verify response includes:
   - `negotiation` object
   - `simulationRuns` array with 6 items
   - `totalCombinations: 6`

## Validation Tests

### Schema Validation Test
```javascript
// This should pass validation now
const validData = {
  userZopa: {
    volumen: { min: 100, max: 1000, target: 500 },
    preis: { min: 10, max: 100, target: 50 },
    laufzeit: { min: 12, max: 36, target: 24 },
    zahlungskonditionen: { min: 30, max: 90, target: 60 }
  },
  counterpartDistance: {
    volumen: 0, preis: 0, laufzeit: 0, zahlungskonditionen: 0
  }
};
```

### Combination Logic Test
```javascript
// Input: 4 techniques × 3 tactics = 12 runs
const techniques = ["technique1", "technique2", "technique3", "technique4"];
const tactics = ["tactic1", "tactic2", "tactic3"];
// Expected: 12 simulation runs created
```

## Next Steps After Testing

Once Phase 1 is validated:

1. **Phase 2**: Implement actual negotiation execution engine
2. **Phase 3**: Build frontend to display combinatorial results
3. **Phase 4**: Add performance optimizations

## Common Issues & Solutions

### Issue: Form validation errors
**Solution**: Check field names match schema exactly

### Issue: Database connection errors  
**Solution**: Set up proper DATABASE_URL environment variable

### Issue: Missing simulation runs
**Solution**: Verify combinatorial loop logic in storage.ts

### Issue: TypeScript errors
**Solution**: Check type definitions and imports

## Success Criteria

✅ Form submits without validation errors
✅ Correct number of simulation runs created (N×M)
✅ Each run has proper technique-tactic combination
✅ API returns structured response with runs array
✅ No duplicate routes or broken endpoints

The foundation is now solid for building the actual negotiation execution engine!
