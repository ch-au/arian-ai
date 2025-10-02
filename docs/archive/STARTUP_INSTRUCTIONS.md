# 🚀 ARIAN AI - Startup Instructions

## Current Status
✅ **Phase 1 Analytics Dashboard** - Complete and functional
✅ **Backend fixed** - Server startup issue resolved
⚠️ **Export temporarily disabled** - CSV/Excel/JSON exports offline (workaround applied)

---

## How to Start the Application

### Option 1: Start Backend & Frontend Separately (Recommended)

**Terminal 1 - Backend:**
```bash
npm run dev:server
```
Wait until you see: `serving on port 3000`

**Terminal 2 - Frontend:**
```bash
npm run dev:client
```
Wait until you see: `Local: http://localhost:5173/`

**Then open browser:**
```
http://localhost:5173
```

### Option 2: Start Everything Together

```bash
npm run dev
```

This starts both backend and frontend using `concurrently`.

**Note:** If this hangs or doesn't show output, use Option 1 instead.

---

## 🎯 What Works Now

### ✅ Full Features
1. **Negotiations Management** - Create, edit, view negotiations
2. **Simulation Monitoring** - Real-time progress tracking
3. **Analytics Dashboard** - Complete visualization suite:
   - Summary metrics cards (success rate, costs, rounds)
   - Success rate heatmap (technique × tactic matrix)
   - Top performers ranking
   - Tab navigation (Overview, Heatmap, Trends, Detailed)
   - Responsive design
   - Loading states
   - Error handling

### ⚠️ Temporarily Disabled
- **Export Buttons** (CSV, Excel, JSON) - Due to ESM import issue
- All visualization and analysis features work perfectly
- Only the export functionality is offline

---

## 📊 Testing the Analytics Dashboard

### Step-by-Step Guide:

1. **Start both servers** (see above)

2. **Navigate to application:**
   ```
   http://localhost:5173
   ```

3. **Create a negotiation** (if none exist):
   - Click "Configure" or "/configure"
   - Fill in negotiation details
   - Add techniques and tactics
   - Save

4. **Run simulations:**
   - Go to simulation monitor
   - Start queue
   - Wait for completion

5. **View analytics:**
   - Click "View Results" button
   - Or navigate to: `/analysis/:negotiationId`
   - Replace `:negotiationId` with actual ID

6. **Explore visualizations:**
   - See summary metrics at top
   - Hover over heatmap cells for details
   - Check top performers list
   - Switch between tabs

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to backend"

**Check if backend is running:**
```bash
lsof -i :3000
```

**Expected output:**
```
node    XXXXX user   XXu  IPv4  ...  TCP *:hbci (LISTEN)
```

**If nothing shows, restart backend:**
```bash
npm run dev:server
```

### Issue: "Port 3000 already in use"

**Kill existing process:**
```bash
lsof -ti:3000 | xargs kill -9
```

Then restart:
```bash
npm run dev:server
```

### Issue: "Frontend loads but shows blank page"

1. **Check backend is running** (see above)

2. **Check browser console** (F12 → Console tab)
   - Look for API errors
   - Note the specific error message

3. **Verify API connection:**
   ```bash
   curl http://localhost:3000/api/negotiations
   ```
   Should return JSON (even if empty array)

4. **Clear caches:**
   ```bash
   rm -rf node_modules/.vite
   rm -rf dist
   ```

5. **Restart frontend:**
   ```bash
   pkill -f vite
   npm run dev:client
   ```

### Issue: "npm run dev hangs"

Use **Option 1** (separate terminals) instead of `npm run dev`.

The `concurrently` package sometimes doesn't display output properly.

---

## 📁 Important Files

### Documentation
- `IMPROVEMENT_PLAN.md` - Complete 12-week roadmap
- `TESTING_CHECKLIST.md` - QA procedures (150+ test cases)
- `DELIVERY_SUMMARY.md` - What was delivered
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `DEBUG_SERVER.md` - Server troubleshooting
- `QUICK_FIX.md` - Export workaround explanation

### Code
- `client/src/pages/analysis-new.tsx` - Analytics dashboard
- `client/src/components/analytics/` - Visualization components
- `client/src/lib/analytics-utils.ts` - Pure calculation functions
- `tests/analytics-utils.test.ts` - 50+ unit tests

---

## 🔧 Known Issues & Workarounds

### 1. Export Functionality Disabled

**Issue:** Analytics export route causes server startup hang

**Impact:** CSV/Excel/JSON export buttons don't work

**Workaround:** Use browser's built-in "Copy table" or take screenshots

**Permanent Fix:** In progress (ESM import debugging)

**File:** `server/routes/analytics-export.ts` (exists but not imported)

### 2. TypeScript Compilation Timeout

**Issue:** `npm run check` times out after 2+ minutes

**Impact:** Slows down development, affects tsx hot reload sometimes

**Workaround:** Check individual files:
```bash
npx tsx --check server/index.ts
npx tsx --check client/src/pages/analysis-new.tsx
```

**Permanent Fix:** Planned in Phase 1 remaining tasks

---

## ✅ Verification Checklist

Before reporting issues, verify:

- [ ] Backend running (`lsof -i :3000` shows process)
- [ ] Frontend running (`lsof -i :5173` shows process)
- [ ] Browser pointing to `http://localhost:5173`
- [ ] No console errors in browser (F12)
- [ ] Database connection working
- [ ] .env file exists with valid credentials

---

## 🆘 Getting Help

### 1. Check Logs

**Backend logs:**
```bash
# If running dev:server directly, logs show in terminal
# Check for specific error messages
```

**Frontend logs:**
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed API calls

### 2. Run Tests

```bash
# Run unit tests
npm test tests/analytics-utils.test.ts

# Should show: 50+ tests passing
```

### 3. Restart Everything

```bash
# Kill all processes
pkill -f tsx
pkill -f vite

# Clear caches
rm -rf node_modules/.vite

# Restart
npm run dev:server  # Terminal 1
npm run dev:client  # Terminal 2
```

### 4. Database Issues

```bash
# Check database connection
npm run db:push

# Reseed data if needed
npm run db:seed
```

---

## 🎉 Success Indicators

When everything is working, you should see:

✅ **Backend terminal:**
```
[INFO] Starting background queue processor
serving on port 3000
```

✅ **Frontend terminal:**
```
VITE v5.x.x ready in XXXms
➜  Local:   http://localhost:5173/
```

✅ **Browser:**
- Application loads
- Navigation works
- API calls succeed (check Network tab)
- Analytics dashboard displays data

---

## 📞 Support Resources

- **Technical Guide:** `IMPLEMENTATION_SUMMARY.md`
- **Testing Guide:** `TESTING_CHECKLIST.md`
- **Roadmap:** `IMPROVEMENT_PLAN.md`
- **Git History:** `git log --oneline -10`

---

**Last Updated:** 2025-10-01
**Version:** Phase 1 Complete (with export workaround)
