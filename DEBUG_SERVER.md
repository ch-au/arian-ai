# Server Startup Debugging Guide

## Issue
`npm run dev` starts but the server doesn't respond. This is likely due to one of these issues:

1. TypeScript compilation hanging (known issue)
2. Import error in new routes
3. Missing dependency

## Quick Fix - Try these in order:

### Option 1: Start server and client separately (Recommended)

```bash
# Terminal 1: Start server
npm run dev:server

# Terminal 2: Start client (in a new terminal)
npm run dev:client

# Then navigate to: http://localhost:5173
```

### Option 2: Check for compilation errors

```bash
# Check server file specifically
npx tsx --check server/index.ts

# Check routes
npx tsx --check server/routes.ts
npx tsx --check server/routes/analytics.ts
```

### Option 3: Verify imports

The new analytics-export route might have an import issue. Check:

```bash
# Try importing the export route
npx tsx -e "import('./server/routes/analytics-export.ts').then(() => console.log('OK')).catch(e => console.error(e))"
```

### Option 4: Temporary workaround - comment out new export route

Edit `server/routes/analytics.ts`:

```typescript
import { Router } from "express";
import { analyticsService } from "../services/analytics";
// import { createAnalyticsExportRouter } from "./analytics-export"; // COMMENTED OUT

export function createAnalyticsRouter(): Router {
  const router = Router();

  router.get("/performance", async (req, res) => {
    // ... existing code
  });

  // Mount export routes
  // router.use(createAnalyticsExportRouter()); // COMMENTED OUT

  return router;
}
```

Then try `npm run dev` again.

## Root Cause

The TypeScript compilation is timing out (as noted in IMPROVEMENT_PLAN.md Phase 1 remaining tasks). This affects:
- `npm run check` (times out)
- Sometimes affects `tsx` hot reload
- Doesn't affect production build

## Permanent Fix (To Do)

1. **Disable incremental compilation temporarily**

   In `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "incremental": false, // Changed from true
       // ...
     }
   }
   ```

2. **Split large files**

   The `simulation-monitor.tsx` (1025 LOC) might be causing issues.

3. **Check circular dependencies**

   ```bash
   npx madge --circular --extensions ts,tsx client/ server/
   ```

## Testing the Analytics Dashboard

If server won't start, you can still test the components:

```bash
# Run unit tests
npm test tests/analytics-utils.test.ts

# Check component compilation
npx tsx client/src/components/analytics/AnalyticsSummaryCards.tsx
```

## Alternative: Use the old analysis route temporarily

The old placeholder `/analysis` route still works. The new route `/analysis/:negotiationId` requires the export API.

## Need Help?

1. Check what's actually running:
   ```bash
   lsof -i :3000
   lsof -i :5173
   ```

2. Kill stuck processes:
   ```bash
   pkill -f tsx
   pkill -f vite
   ```

3. Clear caches:
   ```bash
   rm -rf node_modules/.vite
   rm -rf dist
   ```

4. Reinstall:
   ```bash
   npm install
   ```

## Expected Behavior

When working correctly, you should see:

```
[dev:server] serving on port 3000
[dev:client] VITE v5.x.x ready in XXXms
[dev:client] ➜  Local:   http://localhost:5173/
```

## Logs Location

Check if server is writing logs:
```bash
tail -f logs/*.log 2>/dev/null || echo "No logs yet"
```
