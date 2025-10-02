# Quick Fix: Temporarily Disable Analytics Export

The analytics export route is causing the server to hang during startup. Here's the immediate fix:

## Step 1: Comment out the export route

Edit `server/routes/analytics.ts`:

```typescript
import { Router } from "express";
import { analyticsService } from "../services/analytics.js";
// TEMPORARILY DISABLED - causing server startup hang
// import { createAnalyticsExportRouter } from "./analytics-export.js";

export function createAnalyticsRouter(): Router {
  const router = Router();

  router.get("/performance", async (req, res) => {
    try {
      const { agentId, startDate, endDate } = req.query;
      const report = await analyticsService.generatePerformanceReport(
        agentId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      res.json(report);
    } catch (error) {
      console.error("Failed to generate performance report:", error);
      res.status(500).json({ error: "Failed to generate performance report" });
    }
  });

  // TEMPORARILY DISABLED - causing server startup hang
  // router.use(createAnalyticsExportRouter());

  return router;
}
```

## Step 2: Restart the server

```bash
# Kill any hanging processes
pkill -f tsx

# Start server
npm run dev:server
```

## Step 3: Verify it works

```bash
# Should return: {"status":"ok"}
curl http://localhost:3000/api/health
```

## What this means

- ✅ **Analytics Dashboard** will work perfectly
- ✅ **All visualizations** (heatmap, top performers, summary cards) will work
- ❌ **Export buttons** (CSV, Excel, JSON) won't work temporarily

## Why this happened

The `.js` extension requirement in ESM imports can be tricky. The analytics-export route might have circular dependencies or import issues that need deeper investigation.

## Permanent fix (to do later)

1. Debug why `analytics-export.ts` is hanging on import
2. Check for circular dependencies
3. Verify all imports use `.js` extensions
4. Or: Move export logic inline into `analytics.ts`

For now, you can use the dashboard without export functionality and add exports back later.
