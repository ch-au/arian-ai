# Testing Checklist - Analytics Dashboard

> **Version:** 1.0.0
> **Date:** 2025-10-01
> **Status:** Ready for Testing

---

## 🎯 Purpose

This checklist ensures the new analytics dashboard is thoroughly tested before
production deployment. Follow each section to validate functionality, performance,
and user experience.

---

## ✅ Prerequisites

### Environment Setup
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running
- [ ] Environment variables configured (.env file)
- [ ] Dependencies installed (`npm install`)
- [ ] Database schema migrated (`npm run db:push`)
- [ ] Test data seeded (`npm run db:seed`)

### Development Server
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests
npm test

# Check server is running
curl http://localhost:3000/api/health
```

---

## 📋 Feature Testing

### 1. Analytics Dashboard Access

**Test Case 1.1: Navigation to Dashboard**
- [ ] Navigate to `/analysis/:negotiationId` with valid ID
- [ ] Dashboard loads without errors
- [ ] Page title shows negotiation name
- [ ] Back button works correctly
- [ ] No console errors in browser DevTools

**Test Case 1.2: Invalid Negotiation ID**
- [ ] Navigate to `/analysis/invalid-id`
- [ ] Error message displays: "Invalid negotiation ID"
- [ ] No application crash
- [ ] Can navigate back to negotiations list

**Test Case 1.3: Empty Results**
- [ ] Create new negotiation with no simulations
- [ ] Navigate to analytics dashboard
- [ ] Shows "No data available" message
- [ ] Components render empty states gracefully

---

### 2. Summary Cards (AnalyticsSummaryCards)

**Test Case 2.1: Basic Metrics Display**
- [ ] Total Simulations card shows correct count
- [ ] Success Rate card displays percentage
- [ ] Avg Rounds card shows numeric value
- [ ] Total Cost card displays currency format ($XX.XX)

**Test Case 2.2: Trend Indicators**
- [ ] Green arrow (↑) shows for improvements
- [ ] Red arrow (↓) shows for declines
- [ ] Percentage change calculates correctly
- [ ] "vs previous" label displays

**Test Case 2.3: Loading State**
- [ ] Skeleton loaders show while fetching data
- [ ] Smooth transition from loading to data
- [ ] No layout shift during loading

**Test Case 2.4: Edge Cases**
- [ ] Handles zero simulations gracefully
- [ ] Displays "0%" for 0 success rate
- [ ] Shows "$0.00" for zero cost
- [ ] No division by zero errors

---

### 3. Success Rate Heatmap

**Test Case 3.1: Matrix Display**
- [ ] Heatmap renders with correct dimensions
- [ ] X-axis shows tactic names
- [ ] Y-axis shows technique names
- [ ] All cells have values (0-100)
- [ ] Colors range from red (low) to green (high)

**Test Case 3.2: Interactive Features**
- [ ] Hover over cell shows tooltip
- [ ] Tooltip displays technique + tactic names
- [ ] Tooltip shows exact success rate (X.X%)
- [ ] Tooltip shows sample size (n=X)
- [ ] Cell scales slightly on hover

**Test Case 3.3: Legend**
- [ ] Legend shows color scale (0-25-50-75-100)
- [ ] Colors match heatmap cells
- [ ] "Low" and "High" labels visible

**Test Case 3.4: Empty State**
- [ ] Shows "No data available" when no results
- [ ] Provides helpful message to run simulations
- [ ] No broken rendering

**Test Case 3.5: Large Matrix**
- [ ] Handles 10+ techniques × 10+ tactics
- [ ] Horizontal scroll works if needed
- [ ] Labels remain readable
- [ ] Performance remains smooth

---

### 4. Top Performers

**Test Case 4.1: Ranking Display**
- [ ] Shows top 5 combinations by default
- [ ] Ranks labeled 1-5 with medals (🥇🥈🥉)
- [ ] Technique + Tactic names displayed
- [ ] Success rate badge shown
- [ ] Sample size ("Based on X simulations") visible

**Test Case 4.2: Metrics**
- [ ] Success rate displays as percentage
- [ ] Avg rounds shows numeric value
- [ ] Avg cost shows currency format
- [ ] Icons display correctly (TrendingUp, Clock, DollarSign)

**Test Case 4.3: Sorting Logic**
- [ ] Top performer has highest success rate
- [ ] Ties broken by lowest cost
- [ ] Rankings update when data changes

**Test Case 4.4: Empty State**
- [ ] Shows "No combinations to rank" message
- [ ] Provides guidance to complete simulations
- [ ] No rendering errors

---

### 5. Tab Navigation

**Test Case 5.1: Tab Switching**
- [ ] Overview tab selected by default
- [ ] Click "Heatmap" tab switches view
- [ ] Click "Trends" tab shows placeholder
- [ ] Click "Detailed" tab shows placeholder
- [ ] Active tab highlighted correctly
- [ ] URL does not change when switching tabs

**Test Case 5.2: Tab Content**
- [ ] Overview shows TopPerformers + Heatmap
- [ ] Heatmap tab shows full heatmap only
- [ ] Trends tab shows "Coming soon" message
- [ ] Detailed tab shows "Coming soon" message
- [ ] Content loads without flickering

---

### 6. Export Functionality

**Test Case 6.1: CSV Export**
- [ ] Click "CSV" button triggers download
- [ ] File downloads with correct name (negotiation-title-results.csv)
- [ ] File opens in spreadsheet software
- [ ] Headers present: Run Number, Technique, Tactic, etc.
- [ ] Data rows match simulation results
- [ ] Special characters escaped properly
- [ ] Commas in fields quoted correctly

**Test Case 6.2: Excel Export**
- [ ] Click "Excel" button triggers download
- [ ] File downloads as .xls
- [ ] File opens in Excel/LibreOffice
- [ ] Data formatted correctly

**Test Case 6.3: JSON Export**
- [ ] Click "JSON" button triggers download
- [ ] File is valid JSON (validate with jsonlint.com)
- [ ] Contains negotiation metadata
- [ ] Contains all simulation results
- [ ] Contains summary statistics
- [ ] Properly nested structure

**Test Case 6.4: Export Error Handling**
- [ ] Shows error message if export fails
- [ ] Button re-enables after error
- [ ] Can retry export
- [ ] Network errors handled gracefully

**Test Case 6.5: Export API Endpoint**
```bash
# Test API directly
curl "http://localhost:3000/api/analytics/export/neg-123?format=csv" > test.csv
curl "http://localhost:3000/api/analytics/export/neg-123?format=json" | jq .
```
- [ ] CSV endpoint returns text/csv
- [ ] JSON endpoint returns application/json
- [ ] 404 for invalid negotiation ID
- [ ] 500 handled gracefully

---

### 7. Responsive Design

**Test Case 7.1: Desktop (1920x1080)**
- [ ] All 4 summary cards visible in one row
- [ ] Heatmap fits width without horizontal scroll
- [ ] Top performers list readable
- [ ] Export buttons aligned correctly

**Test Case 7.2: Laptop (1366x768)**
- [ ] Summary cards may wrap to 2 rows
- [ ] All content accessible
- [ ] No overlapping elements

**Test Case 7.3: Tablet (768x1024)**
- [ ] Summary cards stack vertically (2x2)
- [ ] Heatmap scales appropriately
- [ ] Tabs remain accessible
- [ ] Export buttons stack if needed

**Test Case 7.4: Mobile (375x667)**
- [ ] Summary cards stack vertically (1 column)
- [ ] Heatmap scrolls horizontally
- [ ] Tabs remain usable
- [ ] Back button easily accessible

---

### 8. Performance

**Test Case 8.1: Load Time**
- [ ] Dashboard loads in < 3 seconds
- [ ] Initial data fetch completes quickly
- [ ] No perceived lag when switching tabs
- [ ] Smooth scrolling throughout

**Test Case 8.2: Large Datasets**
- [ ] 100+ simulation results load without issues
- [ ] Heatmap renders smoothly
- [ ] Calculations complete quickly (< 1 second)
- [ ] No browser freezing

**Test Case 8.3: Memoization**
- [ ] Switching tabs doesn't recalculate analytics
- [ ] Only recalculates when data changes
- [ ] Console shows memoization working (if logging enabled)

**Test Case 8.4: Memory**
- [ ] No memory leaks when navigating away
- [ ] Browser memory usage stable
- [ ] Multiple dashboard visits don't accumulate memory

---

### 9. Error Handling

**Test Case 9.1: Network Errors**
- [ ] API timeout shows error message
- [ ] 500 error displays friendly message
- [ ] Can retry after error
- [ ] Dashboard doesn't crash

**Test Case 9.2: Invalid Data**
- [ ] Handles null values gracefully
- [ ] Missing fields don't break rendering
- [ ] Corrupt data shows error, not crash
- [ ] Fallback values displayed

**Test Case 9.3: Browser Compatibility**
- [ ] Works in Chrome 90+
- [ ] Works in Firefox 88+
- [ ] Works in Safari 14+
- [ ] Works in Edge 90+

---

### 10. Accessibility

**Test Case 10.1: Keyboard Navigation**
- [ ] Tab key navigates through elements
- [ ] Enter/Space activates buttons
- [ ] Can export without mouse
- [ ] Can switch tabs with keyboard

**Test Case 10.2: Screen Reader**
- [ ] Headings announced correctly
- [ ] Buttons have descriptive labels
- [ ] Card values read aloud
- [ ] Tab roles properly set

**Test Case 10.3: Color Contrast**
- [ ] Text readable on all backgrounds
- [ ] Heatmap colors distinguishable
- [ ] Passes WCAG AA standards (use contrast checker)

---

## 🧪 Unit Tests

### Test Execution
```bash
# Run all tests
npm test

# Run specific test file
npm test tests/analytics-utils.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

**Test Cases to Verify:**
- [ ] calculateSuccessRate: 5 tests pass
- [ ] calculateAverageRounds: 4 tests pass
- [ ] calculateTotalCost: 5 tests pass
- [ ] calculateDealValue: 5 tests pass
- [ ] groupResults: 3 tests pass
- [ ] buildHeatmapMatrix: 3 tests pass
- [ ] getHeatmapColor: 4 tests pass
- [ ] createHistogramBins: 4 tests pass
- [ ] calculateMovingAverage: 3 tests pass
- [ ] normalize: 3 tests pass
- [ ] formatCurrency: 4 tests pass
- [ ] formatPercentage: 3 tests pass
- [ ] formatDuration: 4 tests pass

**Expected Results:**
```
Test Files  1 passed (1)
     Tests  50+ passed (50+)
```

---

## 🔍 Code Quality Checks

### TypeScript
```bash
# Type check (may timeout - known issue)
npm run check

# Build check
npm run build
```
- [ ] No TypeScript errors in new files
- [ ] All imports resolve correctly
- [ ] No 'any' types used

### Linting
```bash
# If linter configured
npm run lint
```
- [ ] No linting errors in new code
- [ ] Consistent code style

### Code Review
- [ ] All functions have JSDoc comments
- [ ] Complex logic has inline comments
- [ ] No console.log statements (use logger)
- [ ] No TODO comments left behind
- [ ] Proper error handling everywhere

---

## 📊 Integration Testing

### End-to-End Flow
**Scenario: Complete Analytics Workflow**

1. **Setup**
   - [ ] Create new negotiation via `/configure`
   - [ ] Add 3+ techniques, 3+ tactics
   - [ ] Start simulation queue

2. **Monitor Progress**
   - [ ] Navigate to `/simulation-monitor/:id`
   - [ ] Observe simulations running
   - [ ] Wait for completion (or complete manually)

3. **View Analytics**
   - [ ] Click "View Results" button
   - [ ] Redirects to `/analysis/:id`
   - [ ] Dashboard loads with real data

4. **Explore Visualizations**
   - [ ] Summary cards show accurate metrics
   - [ ] Heatmap displays technique × tactic matrix
   - [ ] Top performers list makes sense

5. **Export Data**
   - [ ] Export as CSV
   - [ ] Open in spreadsheet
   - [ ] Verify data accuracy
   - [ ] Export as JSON
   - [ ] Validate JSON structure

6. **Return**
   - [ ] Click "Back" button
   - [ ] Returns to negotiations list
   - [ ] Can re-open analytics

**Expected Duration:** 5-10 minutes (depending on simulation speed)

---

## 🐛 Known Issues

### Current Limitations
1. **TypeScript Compilation Timeout**
   - **Issue:** `npm run check` times out after 2+ minutes
   - **Workaround:** Individual file checks work
   - **Status:** To be fixed in Phase 1

2. **Trends Tab Placeholder**
   - **Issue:** Not yet implemented
   - **Status:** Planned for Phase 3

3. **Detailed Results Table Placeholder**
   - **Issue:** Not yet implemented
   - **Status:** Planned for Phase 3

4. **Excel Export**
   - **Issue:** Returns CSV with .xls extension
   - **Note:** Requires xlsx library for true Excel format
   - **Status:** Enhancement for Phase 3

---

## 📝 Test Reporting

### Bug Template
When filing bugs, include:
```markdown
**Title:** [Component] Brief description

**Steps to Reproduce:**
1. Navigate to...
2. Click on...
3. Observe...

**Expected Behavior:**
Dashboard should...

**Actual Behavior:**
Instead, it...

**Environment:**
- Browser: Chrome 120
- OS: macOS 14
- Negotiation ID: neg-abc123

**Screenshots:**
[Attach if relevant]

**Console Errors:**
[Copy from DevTools]
```

### Test Summary Report
After completing all tests, fill out:

**Date:** _______________
**Tester:** _______________
**Environment:** _______________

| Category | Passed | Failed | Skipped | Notes |
|----------|--------|--------|---------|-------|
| Dashboard Access | __ / __ | __ | __ | |
| Summary Cards | __ / __ | __ | __ | |
| Heatmap | __ / __ | __ | __ | |
| Top Performers | __ / __ | __ | __ | |
| Tab Navigation | __ / __ | __ | __ | |
| Export | __ / __ | __ | __ | |
| Responsive | __ / __ | __ | __ | |
| Performance | __ / __ | __ | __ | |
| Error Handling | __ / __ | __ | __ | |
| Accessibility | __ / __ | __ | __ | |
| Unit Tests | __ / __ | __ | __ | |
| Integration | __ / __ | __ | __ | |

**Overall Pass Rate:** ____%

**Critical Issues:**
1. _______________
2. _______________

**Recommendations:**
- _______________
- _______________

---

## ✅ Sign-Off

**Development Team:**
- [ ] All features implemented as specified
- [ ] Unit tests passing
- [ ] Code reviewed
- [ ] Documentation complete

**QA Team:**
- [ ] All test cases executed
- [ ] Critical bugs resolved
- [ ] Performance acceptable
- [ ] UX meets standards

**Product Owner:**
- [ ] Feature meets requirements
- [ ] Acceptance criteria satisfied
- [ ] Ready for production

---

## 🚀 Production Checklist

Before deploying to production:
- [ ] All tests passing (100%)
- [ ] No critical bugs
- [ ] Performance benchmarks met
- [ ] Browser compatibility verified
- [ ] Accessibility standards met
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Rollback plan ready

---

**Last Updated:** 2025-10-01
**Next Review:** After Phase 2 completion
