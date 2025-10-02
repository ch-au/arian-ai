# ARIAN AI Platform - Holistic Improvement Plan

> **Generated:** 2025-10-01
> **Status:** Ready for Implementation
> **Priority:** High Impact → Low Hanging Fruit

---

## 📊 Executive Summary

Based on comprehensive diagnostics of the codebase, this plan addresses:
1. **Configuration Enhancement** - Enhanced user input based on feedback
2. **Results Visualization** - Complete interactive analytics dashboard (currently placeholder)
3. **Code Quality** - Technical debt, duplicates, and type safety
4. **Performance** - Database optimization and scalability improvements
5. **User Experience** - Workflow refinement and feedback integration

---

## 🎯 Phase 1: Critical Fixes & Quick Wins (Week 1-2)

### 1.1 Remove Code Duplication & Cleanup
**Impact:** High | **Effort:** Low

**Issues Found:**
- `simulation-monitor.tsx` (1025 lines) AND `simulation-monitor-improved.tsx` (809 lines) - duplicate implementations
- `analysis.tsx` is a placeholder with TODO message
- Python cache files tracked in git (`.pyc`, `__pycache__`)
- Unused pages: `testing-suite.tsx`, `simulation-confirmation.tsx` appear to be legacy

**Actions:**
```bash
# 1. Consolidate monitor pages
- Delete: client/src/pages/simulation-monitor-improved.tsx (newer version integrated into main)
- Keep: client/src/pages/simulation-monitor.tsx (with improvements merged)

# 2. Update .gitignore
+ .venv/
+ scripts/__pycache__/
+ scripts/*.pyc
+ *.pyc

# 3. Clean git history
git rm --cached scripts/__pycache__/*
git rm --cached "scripts/run_production_negotiation 2.py"
```

**Files to Review for Deletion:**
- `client/src/pages/testing-suite.tsx` (459 lines - appears to be dev tool)
- `client/src/pages/simulation-confirmation.tsx` (280 lines - unclear usage)

---

### 1.2 Fix TypeScript Compilation Issues
**Impact:** High | **Effort:** Medium

**Problem:** `npm run check` times out after 2+ minutes

**Actions:**
1. Add incremental build configuration (already in tsconfig.json ✓)
2. Identify type errors causing infinite loop:
   ```bash
   npx tsc --noEmit --incremental false 2>&1 | head -100
   ```
3. Fix common patterns:
   - Loose `any` types in API responses
   - Missing type imports
   - Circular dependencies

**Expected Outcome:** `npm run check` completes in <30 seconds

---

### 1.3 Database Schema Migration (ZOPA System)
**Impact:** High | **Effort:** Medium

**Current State:**
- Old system: `userZopa` JSONB field (marked DEPRECATED)
- New system: `negotiationDimensions` table (added but not fully adopted)
- Risk: Data inconsistency between systems

**Migration Path:**
```typescript
// 1. Create migration script: server/migrations/migrate-zopa-to-dimensions.ts
// 2. For each negotiation with userZopa:
//    - Parse userZopa JSON
//    - Create negotiationDimensions records
//    - Verify integrity
// 3. Mark userZopa as nullable
// 4. After 1 week, drop userZopa column

// server/migrations/migrate-zopa-to-dimensions.ts
export async function migrateZopaData() {
  const negotiations = await db
    .select({ id, userZopa })
    .from(negotiations)
    .where(isNotNull(negotiations.userZopa));

  for (const neg of negotiations) {
    const zopa = neg.userZopa as UserZopaConfig;

    // Create dimension records
    await db.insert(negotiationDimensions).values([
      { negotiationId: neg.id, name: 'price', ...zopa.preis, priority: 1, unit: 'EUR' },
      { negotiationId: neg.id, name: 'volume', ...zopa.volumen, priority: 2, unit: 'units' },
      // ... etc
    ]);
  }
}
```

**Validation:**
- Ensure all frontend forms use `negotiationDimensions` API
- Update Python service to read from `negotiationDimensions`
- Add foreign key constraints

---

## 🚀 Phase 2: Configuration Enhancement (Week 3-4)

### 2.1 Enhanced Configuration Inputs
**Impact:** High | **Effort:** High
**User Request:** "Configuration will be enhanced based on user feedback (more/different input)"

**Current State Analysis:**
- Configuration wizard: 5 steps (Basic Context, Dimensions, Techniques, Tactics, Counterpart)
- Good: Clear wizard flow, validation, edit mode support
- Missing: Advanced options, templates, bulk import, scenario modeling

**Enhancement Areas:**

#### A. Advanced Negotiation Context
**File:** `client/src/components/negotiation-config-steps.tsx`

**New Inputs to Add:**
```typescript
// Step 1: Basic Context - Add Industry & Complexity
interface EnhancedBasicContext {
  title: string;
  userRole: "buyer" | "seller";
  negotiationType: "one-shot" | "multi-year" | "framework-agreement"; // +1 new type
  relationshipType: "first" | "long-standing" | "distressed"; // +1 new type

  // NEW FIELDS:
  industry: "technology" | "manufacturing" | "services" | "healthcare" | "finance" | "other";
  complexity: "simple" | "moderate" | "complex"; // Influences default rounds/tactics
  stakeholders: string[]; // Multiple parties involved
  regulatoryConstraints: string; // Legal/compliance requirements
  culturalContext: "domestic" | "cross-border" | "multicultural";
  urgency: "low" | "medium" | "high" | "critical"; // Time pressure

  productMarketDescription: string;
  additionalComments: string;
}
```

#### B. Dimension Templates & Validation
**New Features:**
```typescript
// Pre-built dimension sets
const dimensionTemplates = {
  "B2B Software": [
    { name: "License Fee", min: 50000, max: 200000, target: 125000, priority: 1, unit: "USD" },
    { name: "User Seats", min: 100, max: 1000, target: 500, priority: 2, unit: "seats" },
    { name: "Support Level", min: 1, max: 3, target: 2, priority: 2, unit: "tier" },
    { name: "Contract Length", min: 12, max: 60, target: 36, priority: 3, unit: "months" },
    { name: "Payment Terms", min: 0, max: 90, target: 30, priority: 2, unit: "days" },
    { name: "SLA Uptime", min: 95, max: 99.9, target: 99, priority: 1, unit: "%" }
  ],
  "Manufacturing Supply": [...],
  "Real Estate": [...],
  "Custom": [] // Blank slate
};

// Advanced validation
- Min < Target < Max (existing)
- Dimension interdependencies (e.g., volume affects price)
- BATNA (Best Alternative To Negotiated Agreement) configuration
- Reservation price / Walk-away points
```

#### C. Technique/Tactic Selection Enhancement
**Current:** Simple multi-select checkboxes
**Proposed:**
- **Search & Filter:** By category, effectiveness score, cost
- **Recommended Combinations:** AI-suggested based on context
- **Exclude Conflicting:** Prevent incompatible technique-tactic pairs
- **Priority Weighting:** Assign importance to each technique (1-5 scale)

**UI Components:**
```typescript
// Enhanced selection with search + categories
<TechniqueSelector
  techniques={allTechniques}
  selectedIds={config.selectedTechniques}
  onChange={(ids, priorities) => onChange({
    selectedTechniques: ids,
    techniquePriorities: priorities
  })}

  // NEW PROPS:
  showRecommendations={true}
  industryContext={config.industry}
  filterBy={{ category: "persuasion", minEffectiveness: 0.8 }}
  maxSelections={10}
/>
```

#### D. Counterpart Modeling Enhancement
**Current:** Basic personality + ZOPA distance
**Proposed:**
```typescript
interface EnhancedCounterpart {
  // Existing
  counterpartPersonality: string;
  zopaDistance: "close" | "medium" | "far" | "all-distances";

  // NEW FIELDS:
  counterpartPowerLevel: number; // 0-1 scale (relative power)
  counterpartKnowledgeLevel: "expert" | "moderate" | "novice"; // Domain expertise
  counterpartNegotiationStyle: "collaborative" | "competitive" | "avoiding" | "compromising";
  counterpartBATNA: "strong" | "moderate" | "weak"; // Their alternatives
  historicalRelationship: "positive" | "neutral" | "contentious"; // Past interactions

  // Multiple counterpart archetypes to test
  counterpartVariants: CounterpartProfile[]; // Test against 3-5 personality types
}
```

#### E. Simulation Configuration
**New Advanced Options:**
```typescript
interface SimulationSettings {
  maxRounds: number; // Currently hardcoded to 6
  timeoutPerRound: number; // Seconds before AI timeout

  // NEW:
  adaptiveBehavior: boolean; // Agent learns during negotiation
  emotionalIntelligence: boolean; // Detect/respond to sentiment
  informationAsymmetry: "symmetric" | "buyer-advantage" | "seller-advantage";

  // Cost controls
  maxBudgetPerRun: number; // Stop if cost exceeds
  useFastModel: boolean; // Use GPT-3.5 instead of GPT-4

  // Analysis depth
  captureInternalThinking: boolean; // Log agent reasoning (verbose)
  generateExplanations: boolean; // Post-negotiation analysis
}
```

**Implementation Files:**
- `client/src/components/negotiation-config-steps.tsx` - Add new step components
- `shared/schema.ts` - Extend negotiation table with new fields
- `server/routes/negotiations.ts` - Update validation schemas
- `server/services/simulation-queue.ts` - Respect new simulation settings

---

### 2.2 Configuration Presets & Templates
**Impact:** Medium | **Effort:** Medium

**New Feature:**
```typescript
// client/src/components/configuration-templates.tsx
const configurationTemplates = [
  {
    id: "saas-renewal",
    name: "SaaS Renewal Negotiation",
    description: "Renewing enterprise software license",
    industry: "technology",
    defaultDimensions: [...],
    recommendedTechniques: ["Anchoring", "Value-Based Selling"],
    recommendedTactics: ["BATNA Development", "Multi-Issue Trading"]
  },
  {
    id: "supplier-contract",
    name: "Supplier Contract Negotiation",
    description: "Long-term manufacturing supply agreement",
    // ...
  }
];

// UI Component
<TemplateSelector
  templates={configurationTemplates}
  onSelect={(template) => applyTemplate(template)}
/>
```

---

### 2.3 Bulk Configuration via CSV Import
**Impact:** Medium | **Effort:** Medium

**Use Case:** Run 100 variations of a negotiation with slightly different parameters

**Implementation:**
```typescript
// client/src/components/bulk-import.tsx
// Accept CSV with columns:
// negotiation_id, technique_id, tactic_id, personality, zopa_distance, dimension_overrides

interface BulkImportRow {
  negotiationTemplate: string;
  variations: {
    techniqueId: string;
    tacticId: string;
    personalityId: string;
    zopaDistance: string;
    dimensionOverrides?: Record<string, { min, max, target }>;
  }[];
}

// Server endpoint: POST /api/negotiations/bulk
router.post("/bulk", async (req, res) => {
  const { templateId, variations } = req.body;

  // Create base negotiation
  const baseNeg = await storage.getNegotiation(templateId);

  // Create N copies with variations
  const created = await Promise.all(
    variations.map(v => createNegotiationVariant(baseNeg, v))
  );

  res.json({ created: created.length, negotiationIds: created.map(n => n.id) });
});
```

---

## 📊 Phase 3: Results Visualization & Analytics (Week 5-7)

### 3.1 Complete the Analysis Dashboard
**Impact:** CRITICAL | **Effort:** High
**User Request:** "Last screen (summary of results with interactive visualizations) needs to be added"

**Current State:**
- `client/src/pages/analysis.tsx` - Placeholder (19 lines)
- `client/src/pages/analytics.tsx` - Mock data visualization (317 lines)
- `client/src/pages/reports.tsx` - Report generation UI (425 lines)

**Target:** Build comprehensive results dashboard at `/analysis/:negotiationId`

---

#### 3.1.A Overview Screen - Simulation Results Summary

**Route:** `/analysis/:negotiationId`
**File:** `client/src/pages/analysis.tsx` (rebuild from scratch)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Negotiation: "Enterprise SaaS Deal"          [Export] [⚙️] │
├─────────────────────────────────────────────────────────────┤
│  📊 PERFORMANCE OVERVIEW                                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ Total    │ Success  │ Avg      │ Total    │ Best     │   │
│  │ Runs     │ Rate     │ Rounds   │ Cost     │ Deal     │   │
│  │ 120      │ 87%      │ 4.2      │ $18.50   │ +$125k   │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
├─────────────────────────────────────────────────────────────┤
│  🎯 TOP PERFORMING COMBINATIONS                              │
│  1. Reciprocity + BATNA → 95% success, $142k avg value      │
│  2. Anchoring + Framing → 92% success, $138k avg value      │
│  3. Scarcity + Deadline → 89% success, $135k avg value      │
├─────────────────────────────────────────────────────────────┤
│  📈 INTERACTIVE VISUALIZATIONS                               │
│  [Heatmap] [Scatter] [Trends] [Comparison] [Distributions]  │
│                                                              │
│  Currently Showing: Success Rate Heatmap                     │
│  ┌────────────────────────────────────────────┐             │
│  │         Tactics →                          │             │
│  │  Tech  │ BATNA │ Frame │ Trade │ Anchor   │             │
│  │ ────┼───────┼───────┼───────┼──────────   │             │
│  │ Reci │  95%  │  88%  │  82%  │  91%     │             │
│  │ Anch │  92%  │  85%  │  79%  │  94%     │             │
│  │ Scar │  89%  │  81%  │  76%  │  90%     │             │
│  └────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

**Component Structure:**
```typescript
// client/src/pages/analysis.tsx
export default function Analysis() {
  const { negotiationId } = useParams();
  const [selectedView, setSelectedView] = useState<'heatmap' | 'scatter' | 'trends'>('heatmap');

  // Fetch data
  const { data: negotiation } = useQuery([`/api/negotiations/${negotiationId}`]);
  const { data: results } = useQuery([`/api/simulations/results/${negotiationId}`]);
  const { data: analytics } = useQuery([`/api/analytics/negotiation/${negotiationId}`]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <AnalyticsSummaryCards data={analytics} />

      {/* Top Performers */}
      <TopPerformingCombinations results={results} />

      {/* Interactive Visualizations */}
      <VisualizationPanel
        view={selectedView}
        onViewChange={setSelectedView}
        data={results}
      />

      {/* Detailed Results Table */}
      <ResultsDataTable results={results} />
    </div>
  );
}
```

---

#### 3.1.B Interactive Visualization Components

**Component 1: Success Rate Heatmap**
```typescript
// client/src/components/analytics/success-heatmap.tsx
import { HeatMapGrid } from 'react-grid-heatmap';

export function SuccessRateHeatmap({ results }: { results: SimulationResult[] }) {
  // Group by technique x tactic
  const matrix = useMemo(() => {
    return buildMatrix(results, 'techniqueId', 'tacticId', (runs) => {
      const successful = runs.filter(r => r.zopaAchieved).length;
      return (successful / runs.length) * 100;
    });
  }, [results]);

  return (
    <HeatMapGrid
      data={matrix.values}
      xLabels={matrix.tacticNames}
      yLabels={matrix.techniqueNames}
      cellRender={(x, y, value) => (
        <Tooltip content={`${matrix.techniqueNames[y]} + ${matrix.tacticNames[x]}: ${value}%`}>
          <div style={{ backgroundColor: getHeatColor(value) }}>
            {value}%
          </div>
        </Tooltip>
      )}
    />
  );
}
```

**Component 2: Deal Value Scatter Plot**
```typescript
// client/src/components/analytics/value-scatter.tsx
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip } from 'recharts';

export function DealValueScatter({ results }: { results: SimulationResult[] }) {
  const scatterData = results.map(r => ({
    x: r.totalRounds,
    y: calculateDealValue(r.finalTerms),
    techniqueId: r.techniqueId,
    tacticId: r.tacticId,
    color: r.zopaAchieved ? '#22c55e' : '#ef4444'
  }));

  return (
    <ScatterChart width={800} height={400}>
      <XAxis dataKey="x" name="Rounds" />
      <YAxis dataKey="y" name="Deal Value" />
      <Tooltip
        content={({ payload }) => (
          <div className="bg-white p-3 border rounded shadow">
            <p>Rounds: {payload[0]?.payload.x}</p>
            <p>Value: ${payload[0]?.payload.y}</p>
            <p>Technique: {getTechniqueName(payload[0]?.payload.techniqueId)}</p>
          </div>
        )}
      />
      <Scatter data={scatterData} fill="#8884d8" />
    </ScatterChart>
  );
}
```

**Component 3: Trend Analysis Over Time**
```typescript
// client/src/components/analytics/trend-analysis.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function TrendAnalysis({ results }: { results: SimulationResult[] }) {
  // Group by execution order to show learning trends
  const trendData = results
    .sort((a, b) => a.executionOrder - a.executionOrder)
    .reduce((acc, result, idx) => {
      const window = results.slice(Math.max(0, idx - 10), idx + 1);
      const avgSuccess = window.filter(r => r.zopaAchieved).length / window.length;

      acc.push({
        executionOrder: result.executionOrder,
        movingAvgSuccess: avgSuccess * 100,
        actualSuccess: result.zopaAchieved ? 100 : 0
      });
      return acc;
    }, []);

  return (
    <LineChart width={800} height={300} data={trendData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="executionOrder" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="movingAvgSuccess" stroke="#8884d8" name="10-Run Avg" />
    </LineChart>
  );
}
```

**Component 4: Dimension Value Distribution**
```typescript
// client/src/components/analytics/dimension-distribution.tsx
import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts';

export function DimensionDistribution({ results, dimensionName }: Props) {
  // Create histogram of final values for this dimension
  const histogram = useMemo(() => {
    const values = results
      .map(r => r.dimensionResults?.[dimensionName]?.finalValue)
      .filter(v => v !== undefined);

    // Create 10 bins
    const bins = createBins(values, 10);
    return bins.map(bin => ({
      range: `${bin.min}-${bin.max}`,
      count: bin.values.length,
      isTargetRange: bin.containsTarget
    }));
  }, [results, dimensionName]);

  return (
    <BarChart width={600} height={300} data={histogram}>
      <XAxis dataKey="range" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="count">
        {histogram.map((entry, index) => (
          <Cell key={index} fill={entry.isTargetRange ? '#22c55e' : '#94a3b8'} />
        ))}
      </Bar>
    </BarChart>
  );
}
```

**Component 5: Personality Effectiveness**
```typescript
// client/src/components/analytics/personality-comparison.tsx
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export function PersonalityEffectiveness({ results }: Props) {
  const personalityScores = useMemo(() => {
    // Group by personality archetype
    const grouped = groupBy(results, 'personalityArchetype');

    return Object.entries(grouped).map(([personality, runs]) => {
      const successRate = runs.filter(r => r.zopaAchieved).length / runs.length;
      const avgValue = average(runs.map(r => calculateDealValue(r.finalTerms)));
      const avgRounds = average(runs.map(r => r.totalRounds));
      const avgCost = average(runs.map(r => parseFloat(r.actualCost || '0')));

      return {
        personality,
        successRate: successRate * 100,
        avgValue: normalize(avgValue, 0, maxValue),
        efficiency: normalize(1 / avgRounds, 0, 1), // Fewer rounds = more efficient
        costEffectiveness: normalize(1 / avgCost, 0, 1)
      };
    });
  }, [results]);

  return (
    <RadarChart width={500} height={500} data={personalityScores}>
      <PolarGrid />
      <PolarAngleAxis dataKey="personality" />
      <PolarRadiusAxis />
      <Radar name="Success Rate" dataKey="successRate" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
    </RadarChart>
  );
}
```

---

#### 3.1.C Results Data Table with Filtering

**Component:**
```typescript
// client/src/components/analytics/results-data-table.tsx
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

export function ResultsDataTable({ results }: { results: SimulationResult[] }) {
  const [filters, setFilters] = useState({
    techniqueIds: [],
    tacticIds: [],
    successOnly: false,
    minRounds: 0,
    maxRounds: 10
  });

  const columns: ColumnDef<SimulationResult>[] = [
    { accessorKey: 'runNumber', header: '#' },
    {
      accessorKey: 'techniqueId',
      header: 'Technique',
      cell: ({ row }) => <TechniqueBadge id={row.original.techniqueId} />
    },
    {
      accessorKey: 'tacticId',
      header: 'Tactic',
      cell: ({ row }) => <TacticBadge id={row.original.tacticId} />
    },
    {
      accessorKey: 'zopaAchieved',
      header: 'Success',
      cell: ({ row }) => row.original.zopaAchieved ? '✅' : '❌'
    },
    { accessorKey: 'totalRounds', header: 'Rounds' },
    {
      accessorKey: 'finalTerms',
      header: 'Deal Value',
      cell: ({ row }) => `$${calculateDealValue(row.original.finalTerms).toLocaleString()}`
    },
    {
      accessorKey: 'actualCost',
      header: 'Cost',
      cell: ({ row }) => `$${parseFloat(row.original.actualCost || '0').toFixed(2)}`
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button size="sm" onClick={() => viewConversation(row.original.id)}>
          View Details
        </Button>
      )
    }
  ];

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (filters.successOnly && !r.zopaAchieved) return false;
      if (filters.techniqueIds.length && !filters.techniqueIds.includes(r.techniqueId)) return false;
      if (filters.tacticIds.length && !filters.tacticIds.includes(r.tacticId)) return false;
      if (r.totalRounds < filters.minRounds || r.totalRounds > filters.maxRounds) return false;
      return true;
    });
  }, [results, filters]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Results</CardTitle>
        <ResultsFilter filters={filters} onChange={setFilters} />
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={filteredResults}
          pagination
          sorting
          filtering
        />
      </CardContent>
    </Card>
  );
}
```

---

#### 3.1.D Conversation Viewer & Playback

**Modal for viewing individual negotiation transcripts:**
```typescript
// client/src/components/analytics/conversation-viewer.tsx
export function ConversationViewer({ simulationRunId }: Props) {
  const { data: run } = useQuery([`/api/simulations/${simulationRunId}`]);
  const [currentRound, setCurrentRound] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-advance through rounds
  useEffect(() => {
    if (!isPlaying || !run?.conversationLog) return;

    const timer = setTimeout(() => {
      if (currentRound < run.conversationLog.length - 1) {
        setCurrentRound(curr => curr + 1);
      } else {
        setIsPlaying(false);
      }
    }, 2000 / playbackSpeed);

    return () => clearTimeout(timer);
  }, [isPlaying, currentRound, playbackSpeed]);

  return (
    <Dialog>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Negotiation Playback - Run #{run?.runNumber}</DialogTitle>
        </DialogHeader>

        {/* Playback Controls */}
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Slider
            value={[currentRound]}
            max={run?.conversationLog.length - 1}
            onValueChange={([val]) => setCurrentRound(val)}
          />
          <Select value={playbackSpeed.toString()} onValueChange={v => setPlaybackSpeed(Number(v))}>
            <SelectItem value="0.5">0.5x</SelectItem>
            <SelectItem value="1">1x</SelectItem>
            <SelectItem value="2">2x</SelectItem>
          </Select>
        </div>

        {/* Conversation Display */}
        <ScrollArea className="h-[500px]">
          {run?.conversationLog.slice(0, currentRound + 1).map((turn, idx) => (
            <div key={idx} className={cn(
              "mb-4 p-4 rounded-lg",
              turn.agent === 'buyer' ? 'bg-blue-50' : 'bg-green-50'
            )}>
              <div className="flex items-center justify-between mb-2">
                <Badge>{turn.agent.toUpperCase()}</Badge>
                <span className="text-sm text-gray-500">Round {turn.round}</span>
              </div>
              <p className="text-sm mb-2">{turn.message}</p>

              {turn.offer && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <p className="text-xs font-medium mb-1">Offer:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(turn.offer.dimension_values).map(([dim, val]) => (
                      <div key={dim}>{dim}: {val}</div>
                    ))}
                  </div>
                </div>
              )}

              {turn.internal_analysis && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-600 cursor-pointer">Internal Analysis</summary>
                  <p className="text-xs mt-1 text-gray-700">{turn.internal_analysis}</p>
                </details>
              )}
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

---

#### 3.1.E Export & Reporting

**Export Options:**
```typescript
// client/src/components/analytics/export-options.tsx
export function ExportOptions({ negotiationId }: Props) {
  const handleExport = async (format: 'csv' | 'json' | 'pdf' | 'excel') => {
    const response = await fetch(`/api/analytics/export/${negotiationId}?format=${format}`);
    const blob = await response.blob();
    downloadBlob(blob, `negotiation-${negotiationId}.${format}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2" />
          Export Results
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          CSV (Data)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          Excel (Formatted)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          JSON (Complete)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          PDF (Report)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Server Implementation:**
```typescript
// server/routes/analytics.ts
router.get("/export/:negotiationId", async (req, res) => {
  const { negotiationId } = req.params;
  const { format } = req.query;

  const results = await SimulationQueueService.getSimulationResultsByNegotiation(negotiationId);
  const negotiation = await storage.getNegotiation(negotiationId);

  switch (format) {
    case 'csv':
      const csv = generateCSV(results);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="results-${negotiationId}.csv"`);
      return res.send(csv);

    case 'excel':
      const xlsx = await generateExcel(results, negotiation);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(xlsx);

    case 'pdf':
      const pdf = await generatePDFReport(results, negotiation);
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(pdf);

    case 'json':
    default:
      return res.json({ negotiation, results });
  }
});

function generateCSV(results: SimulationResult[]): string {
  const headers = ['Run #', 'Technique', 'Tactic', 'Success', 'Rounds', 'Cost', 'Deal Value'];
  const rows = results.map(r => [
    r.runNumber,
    r.techniqueId,
    r.tacticId,
    r.zopaAchieved ? 'Yes' : 'No',
    r.totalRounds,
    r.actualCost,
    calculateDealValue(r.finalTerms)
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
```

---

### 3.2 Real-Time Analytics During Execution
**Impact:** Medium | **Effort:** Medium

**Enhancement:** Show live analytics while simulation queue is running

**Component:**
```typescript
// client/src/components/analytics/live-analytics.tsx
export function LiveAnalyticsDashboard({ queueId }: Props) {
  const { data: queueStatus } = useQuery([`/api/simulations/queue/${queueId}/status`], {
    refetchInterval: 2000
  });

  const { data: partialResults } = useQuery([`/api/simulations/queue/${queueId}/results`], {
    refetchInterval: 5000
  });

  // Calculate interim statistics from completed runs
  const liveStats = useMemo(() => {
    const completed = partialResults?.filter(r => r.status === 'completed') || [];
    return {
      successRate: (completed.filter(r => r.zopaAchieved).length / completed.length) * 100,
      avgRounds: average(completed.map(r => r.totalRounds)),
      totalCost: sum(completed.map(r => parseFloat(r.actualCost || '0'))),
      estimatedTimeRemaining: queueStatus?.estimatedTimeRemaining
    };
  }, [partialResults, queueStatus]);

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="Success Rate (So Far)"
        value={`${liveStats.successRate.toFixed(1)}%`}
        trend={/* compare to running average */}
      />
      {/* ... more live metrics */}
    </div>
  );
}
```

---

## ⚡ Phase 4: Performance & Scalability (Week 8-9)

### 4.1 Database Optimization
**Impact:** High | **Effort:** Medium

**Issues:**
- Large JSONB fields (`conversationLog`, `dimensionResults`) slow queries
- No indexes on foreign keys
- No pagination on `/api/simulations/results`

**Actions:**

#### A. Add Database Indexes
```sql
-- Add missing indexes
CREATE INDEX idx_simulation_runs_negotiation ON simulation_runs(negotiation_id);
CREATE INDEX idx_simulation_runs_queue ON simulation_runs(queue_id);
CREATE INDEX idx_simulation_runs_status ON simulation_runs(status);
CREATE INDEX idx_simulation_runs_technique ON simulation_runs(technique_id);
CREATE INDEX idx_simulation_runs_tactic ON simulation_runs(tactic_id);

-- Composite index for common queries
CREATE INDEX idx_simulation_runs_queue_status ON simulation_runs(queue_id, status);
CREATE INDEX idx_simulation_queue_negotiation_status ON simulation_queue(negotiation_id, status);

-- GIN index for JSONB fields (if querying inside JSON)
CREATE INDEX idx_simulation_runs_dimension_results ON simulation_runs USING GIN (dimension_results);
```

#### B. Implement Pagination
```typescript
// server/routes/analytics.ts
router.get("/simulations/results/:negotiationId", async (req, res) => {
  const { negotiationId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const [results, total] = await Promise.all([
    db.select()
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId))
      .orderBy(simulationRuns.executionOrder)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() })
      .from(simulationRuns)
      .where(eq(simulationRuns.negotiationId, negotiationId))
  ]);

  res.json({
    results,
    pagination: {
      page,
      limit,
      total: total[0].count,
      pages: Math.ceil(total[0].count / limit)
    }
  });
});
```

#### C. Optimize Conversation Log Storage
**Problem:** Storing full conversation logs as JSONB in every row bloats table

**Solution:** Separate table for conversations
```typescript
// shared/schema.ts
export const conversationTurns = pgTable("conversation_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationRunId: uuid("simulation_run_id").references(() => simulationRuns.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  agent: text("agent").notNull(), // "buyer" | "seller"
  message: text("message").notNull(),
  offerData: jsonb("offer_data"),
  internalAnalysis: text("internal_analysis"),
  timestamp: timestamp("timestamp").defaultNow()
});

// Migrate existing conversationLog to new table
export async function migrateConversationLogs() {
  const runs = await db.select().from(simulationRuns).where(isNotNull(simulationRuns.conversationLog));

  for (const run of runs) {
    const log = run.conversationLog as any[];
    await db.insert(conversationTurns).values(
      log.map((turn, idx) => ({
        simulationRunId: run.id,
        roundNumber: idx + 1,
        agent: turn.agent,
        message: turn.message,
        offerData: turn.offer,
        internalAnalysis: turn.internal_analysis
      }))
    );
  }
}
```

---

### 4.2 API Response Caching
**Impact:** Medium | **Effort:** Low

**Implementation:**
```typescript
// server/services/cache.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minute default

export function cached<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached) return Promise.resolve(cached);

  return fetchFn().then(result => {
    cache.set(key, result, ttl);
    return result;
  });
}

// Usage in routes
router.get("/analytics/negotiation/:id", async (req, res) => {
  const analytics = await cached(
    `analytics:${req.params.id}`,
    600, // 10 minutes
    () => calculateAnalytics(req.params.id)
  );

  res.json(analytics);
});
```

---

### 4.3 WebSocket Optimization
**Impact:** Medium | **Effort:** Low

**Current:** Broadcasting to all connected clients
**Optimized:** Room-based broadcasting

```typescript
// server/services/negotiation-engine.ts
export class NegotiationEngine {
  private io: Server;

  constructor(httpServer: Server) {
    this.io = new Server(httpServer, {
      cors: { origin: "*" }
    });

    this.io.on('connection', (socket) => {
      // Join negotiation-specific rooms
      socket.on('subscribe:negotiation', (negotiationId) => {
        socket.join(`negotiation:${negotiationId}`);
      });

      socket.on('unsubscribe:negotiation', (negotiationId) => {
        socket.leave(`negotiation:${negotiationId}`);
      });
    });
  }

  broadcast(event: { type: string; negotiationId: string; data: any }) {
    // Only send to subscribers of this negotiation
    this.io.to(`negotiation:${event.negotiationId}`).emit(event.type, event.data);
  }
}
```

---

## 🔧 Phase 5: Code Quality & Maintainability (Week 10)

### 5.1 Split Large Components
**Impact:** Medium | **Effort:** Medium

**Files to Refactor:**
1. `CreateNegotiationForm.tsx` (1277 lines) → Split into:
   - `NegotiationFormContext.tsx` - Form state management
   - `BasicInfoStep.tsx` - Step 1
   - `DimensionsStep.tsx` - Step 2
   - `StrategiesStep.tsx` - Step 3

2. `simulation-monitor.tsx` (1025 lines) → Split into:
   - `SimulationMonitorLayout.tsx` - Main layout
   - `QueueStatusPanel.tsx` - Status cards
   - `SimulationResultsGrid.tsx` - Results grid
   - `ConversationModal.tsx` - Conversation viewer

3. `negotiation-config-steps.tsx` (816 lines) → Already modular, but extract:
   - `DimensionEditor.tsx` - Individual dimension form
   - `TechniqueSelector.tsx` - Technique selection UI
   - `TacticSelector.tsx` - Tactic selection UI

---

### 5.2 Consistent Error Handling
**Impact:** Medium | **Effort:** Low

**Create unified error handling:**
```typescript
// client/src/lib/api-error-handler.ts
export class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

export async function handleAPIResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      error.message || response.statusText,
      error.details
    );
  }

  return response.json();
}

// Usage
try {
  const data = await fetch('/api/negotiations').then(handleAPIResponse);
} catch (error) {
  if (error instanceof APIError) {
    toast({
      title: `Error ${error.status}`,
      description: error.message,
      variant: 'destructive'
    });
  }
}
```

---

### 5.3 Add Missing Tests
**Impact:** Low | **Effort:** High

**Test Coverage Gaps:**
```typescript
// tests/simulation-queue.test.ts - Add tests for:
- Queue creation with multiple personalities/distances
- Restart failed simulations
- Crash recovery logic
- Timeout detection

// tests/analytics.test.ts - Add tests for:
- Heatmap matrix calculation
- Deal value calculations
- Export format generation

// tests/negotiation-config.test.ts - Add tests for:
- Dimension validation
- Template application
- Bulk import parsing
```

---

## 📋 Phase 6: User Experience Refinements (Week 11-12)

### 6.1 Improved Onboarding Flow
**Impact:** Medium | **Effort:** Low

**Add guided tour for new users:**
```typescript
// client/src/components/onboarding/product-tour.tsx
import { driver } from "driver.js";

const productTour = driver({
  showProgress: true,
  steps: [
    {
      element: '#create-negotiation-btn',
      popover: {
        title: 'Create Your First Negotiation',
        description: 'Start by defining the parameters of your negotiation scenario'
      }
    },
    {
      element: '#technique-selector',
      popover: {
        title: 'Choose Techniques',
        description: 'Select influence techniques to test in your simulations'
      }
    },
    // ... more steps
  ]
});
```

---

### 6.2 Keyboard Shortcuts
**Impact:** Low | **Effort:** Low

```typescript
// client/src/hooks/use-keyboard-shortcuts.ts
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n': // Cmd+N - New negotiation
            e.preventDefault();
            navigate('/configure');
            break;
          case 'k': // Cmd+K - Command palette
            e.preventDefault();
            openCommandPalette();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}
```

---

### 6.3 Better Loading States
**Impact:** Medium | **Effort:** Low

**Add skeleton loaders instead of spinners:**
```typescript
// client/src/components/ui/skeleton-loader.tsx
export function NegotiationCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

// Usage
{isLoading ? (
  <NegotiationCardSkeleton />
) : (
  <NegotiationCard data={data} />
)}
```

---

## 📦 Implementation Priorities

### Must-Have (P0) - Launch Blockers
1. ✅ Complete Results Visualization Dashboard (`/analysis/:id`)
2. ✅ Fix TypeScript compilation issues
3. ✅ Remove duplicate pages (simulation-monitor)
4. ✅ Database schema migration (ZOPA → dimensions)

### Should-Have (P1) - High Value
5. Enhanced configuration inputs (industry, complexity, templates)
6. Export functionality (CSV, Excel, PDF)
7. Database indexes + pagination
8. Conversation playback viewer

### Nice-to-Have (P2) - Polish
9. Keyboard shortcuts
10. Onboarding tour
11. Skeleton loaders
12. Advanced counterpart modeling

---

## 📈 Success Metrics

**Phase 1-2 (Configuration):**
- ✅ User can create negotiation in <3 minutes
- ✅ 80%+ of users use dimension templates
- ✅ Configuration completion rate >90%

**Phase 3 (Analytics):**
- ✅ Users spend >5 min analyzing results
- ✅ Export feature used in >50% of completed negotiations
- ✅ Heatmap/scatter plots viewed in >70% of sessions

**Phase 4-5 (Performance):**
- ✅ API response time <500ms (p95)
- ✅ Dashboard loads in <2 seconds
- ✅ No TypeScript errors on `npm run check`

---

## 🚀 Quick Start Guide

### Week 1 Kickoff
```bash
# 1. Clean up duplicates
git rm client/src/pages/simulation-monitor-improved.tsx
git rm "scripts/run_production_negotiation 2.py"

# 2. Fix gitignore
echo ".venv/" >> .gitignore
echo "scripts/__pycache__/" >> .gitignore

# 3. Run diagnostics
npm run check 2>&1 | tee typescript-errors.log

# 4. Create feature branch
git checkout -b feature/analytics-dashboard

# 5. Start with Analysis page
touch client/src/pages/analysis-new.tsx
touch client/src/components/analytics/success-heatmap.tsx
```

---

## 📚 Reference Documentation

**Update these docs as you implement:**
- `docs/ARCHITECTURE.md` - Add analytics service
- `docs/DATA_MODEL_SPECIFICATION.md` - Document new fields
- `docs/DEVELOPMENT.md` - Add testing guidelines
- `CLAUDE.md` - Update with new patterns

---

## 🎉 Conclusion

This plan provides a **12-week roadmap** to transform ARIAN AI from a functional MVP to a polished, production-ready platform with:

✅ Enhanced configuration flexibility
✅ Complete results visualization
✅ Optimized performance
✅ Clean, maintainable codebase

**Next Steps:**
1. Review this plan with stakeholders
2. Prioritize phases based on user feedback
3. Start with Phase 1 cleanup (quick wins)
4. Parallel work on Phase 2 (config) + Phase 3 (analytics)

**Questions? Adjustments?**
This is a living document - update as requirements evolve!
