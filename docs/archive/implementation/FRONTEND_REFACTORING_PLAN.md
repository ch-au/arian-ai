# Frontend Refactoring Plan - ARIAN AI

## Entscheidungen (vom Nutzer bestätigt)

### A) Informationsarchitektur: "Dashboard First"
```
/ (Dashboard)
  ↳ Überblick über alle Verhandlungen
  ↳ Quick Actions
  ↳ Metriken

/negotiations/:id (Monitoring-Fokus)
  ↳ Live-Status der Simulation
  ↳ Queue-Übersicht
  ↳ Active Runs
  ↳ Button → "Zur Detail-Analyse" (nur wenn completed)

/negotiations/:id/analysis (Neue erweiterte Analyse)
  ↳ Run-Vergleich
  ↳ AI-Insights
  ↳ Link → Playbook

/playbook (NEU)
  ↳ Kernlektionen über alle Verhandlungen
  ↳ Best Practices
```

### B) Create-Flow: 7 → 4 Schritte kompakter
- Techniken/Taktiken als Toggle-Sections
- Markt-Insights NACH Input-Feldern
- Voice-Input beibehalten (wichtig!)
- Bessere optische Klarheit

### C) Monitoring: Fokus auf Essentials
- Run-Vergleich auslagern → Analysis
- Fokus: Queue Stats, Active Runs, Live Feed

### D) Navigation: Alle Vorschläge umsetzen
- Sidebar: nur globale Navigation
- Configure → umbenennen
- Monitor/Analysis aus Sidebar

### E) Analytics-Ausbau (3 Hauptfeatures)
1. **Strukturierter Run-Vergleich** (aus Monitoring ausgelagert)
2. **AI-Insights** (automatisch nach Run-Ende)
3. **Playbook** (eigene Seite, Kernlektionen)

---

## Implementierungs-Phasen

### 🎯 PHASE 1: Routing & Navigation (Foundation)
**Ziel:** Klare Informationsarchitektur schaffen

#### 1.1 Routing umstrukturieren
```typescript
// client/src/App.tsx

// ALT:
<Route path="/" component={Negotiations} />
<Route path="/negotiations" component={Negotiations} />
<Route path="/monitor/:id" component={Monitor} />
<Route path="/analysis/:negotiationId" component={AnalysisDashboard} />
<Route path="/negotiations/:id/analysis" component={NegotiationAnalysis} />

// NEU:
<Route path="/" component={Dashboard} />  // Dashboard First!
<Route path="/negotiations" component={NegotiationsList} />  // Übersichtstabelle
<Route path="/negotiations/:id" component={NegotiationMonitor} />  // Monitoring-Fokus
<Route path="/negotiations/:id/analysis" component={AnalysisView} />  // Erweiterte Analyse
<Route path="/playbook" component={PlaybookView} />  // NEU: Kernlektionen

// ENTFERNEN:
<Route path="/configure" /> // veraltet
<Route path="/monitor/:id" /> // redundant
<Route path="/analysis/:negotiationId" /> // konsolidieren
<Route path="/simulation-monitor/:negotiationId" /> // redundant
```

#### 1.2 Sidebar vereinfachen
```typescript
// client/src/components/layout/sidebar.tsx

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Übersicht & Metriken"
  },
  {
    title: "Verhandlungen",
    href: "/negotiations",
    icon: HandMetal,
    description: "Alle Simulationen"
  },
  {
    title: "Playbook",  // NEU
    href: "/playbook",
    icon: BookOpen,
    description: "Lektionen & Best Practices"
  },
];

// REMOVE: Configure, Monitor, Analysis (kontextabhängig!)
```

#### 1.3 Dashboard als Landing Page optimieren
**Datei:** `client/src/pages/dashboard.tsx`

**Änderungen:**
- Prominenter "Neue Verhandlung" Button (Hero-Section)
- Schnellzugriff auf aktive Simulationen
- Link zu `/negotiations` für vollständige Liste

```typescript
// Hero-Section hinzufügen:
<PageHero
  title="ARIAN Dashboard"
  description="Übersicht über Ihre Verhandlungs-Simulationen"
  actions={
    <Button onClick={() => setLocation('/create-negotiation')} size="lg">
      <Plus className="mr-2" />
      Neue Verhandlung
    </Button>
  }
/>
```

#### 1.4 Neue NegotiationsList Page
**Datei (neu):** `client/src/pages/negotiations-list.tsx`

- Bisherige `negotiations.tsx` wird zu `negotiations-list.tsx`
- Einfache Tabelle OHNE Monitoring-Details
- Klick auf Row → `/negotiations/:id` (Monitoring)

#### 1.5 Monitor wird zur Haupt-Negotiation-Seite
**Datei:** `client/src/pages/monitor.tsx` → `client/src/pages/negotiation-monitor.tsx`

**Änderungen:**
- Route ändert sich: `/monitor/:id` → `/negotiations/:id`
- Fokus auf Live-Status
- Run-Vergleich-Section ENTFERNEN
- Button "Zur Analyse" prominent platzieren (nur wenn status=completed)

```typescript
// Am Ende der Seite:
{negotiation.status === 'completed' && (
  <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Simulation abgeschlossen</h3>
          <p className="text-sm text-muted-foreground">
            Detaillierte Analyse mit AI-Insights verfügbar
          </p>
        </div>
        <Button onClick={() => setLocation(`/negotiations/${negotiationId}/analysis`)}>
          <BarChart3 className="mr-2" />
          Zur Analyse
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

**Dateien:**
- `client/src/App.tsx` - Routing ändern
- `client/src/components/layout/sidebar.tsx` - Navigation vereinfachen
- `client/src/pages/dashboard.tsx` - Hero hinzufügen
- `client/src/pages/negotiations-list.tsx` - Neue einfache Liste (aus negotiations.tsx)
- `client/src/pages/negotiation-monitor.tsx` - Rename + Run-Vergleich entfernen
- `client/src/pages/negotiation-detail.tsx` - LÖSCHEN (redundant)

---

### 🎨 PHASE 2: Create-Flow kompakter (7 → 4 Schritte)
**Ziel:** Bessere UX, weniger Schritte, mehr Klarheit

#### 2.1 Schritt-Konsolidierung

**ALT (7 Schritte):**
1. Unternehmen
2. Markt
3. Partner
4. Produkte
5. Dimensionen
6. Strategie
7. Zusammenfassung

**NEU (4 Schritte):**

##### **Schritt 1: Basis-Informationen**
Konsolidiert: Unternehmen + Markt + Partner
```typescript
// Layout: 2-spaltig für kompaktere Darstellung
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Linke Spalte: Unternehmen & Markt */}
  <Section title="Ihr Unternehmen">
    <FormField name="title" />  {/* Prominent */}
    <FormField name="company.organization" />
    <FormField name="company.country" />
    <FormField name="market.name" />
    <FormField name="market.currencyCode" />
  </Section>

  {/* Rechte Spalte: Partner */}
  <Section title="Verhandlungspartner">
    <FormField name="counterpart.name" />
    <FormField name="counterpart.kind" />
    <FormField name="counterpart.powerBalance" />
    <FormField name="counterpart.style" />
  </Section>
</div>

{/* Full Width: Kontextuelle Infos */}
<Section title="Kontext">
  <FormField name="description" />
  <VoiceInput />  {/* WICHTIG: Beibehalten! */}

  <FormField name="market.intelligence" />
  <VoiceInput />

  {/* Markt-Insights NACH den Feldern */}
  <MarketInsightsPanel />  {/* Button → Insights abrufen */}
</Section>
```

##### **Schritt 2: Produkte & Dimensionen**
Konsolidiert: Beide in einem Schritt
```typescript
<Tabs defaultValue="products">
  <TabsList>
    <TabsTrigger value="products">
      Produkte ({products.length})
    </TabsTrigger>
    <TabsTrigger value="dimensions">
      Dimensionen ({dimensions.length})
    </TabsTrigger>
  </TabsList>

  <TabsContent value="products">
    <ProductsTable />  {/* Wie aktuell */}
  </TabsContent>

  <TabsContent value="dimensions">
    <DimensionsTable />  {/* Wie aktuell */}
  </TabsContent>
</Tabs>

{/* Oder: Side-by-side auf großen Screens */}
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
  <ProductsSection />
  <DimensionsSection />
</div>
```

##### **Schritt 3: Strategie**
Techniken & Taktiken als Toggle/Collapsible
```typescript
<Section title="Strategie">
  <div className="grid grid-cols-2 gap-4">
    <FormField name="strategy.userRole" />
    <FormField name="strategy.maxRounds" />
  </div>

  {/* Toggle-Sections für bessere Übersicht */}
  <Collapsible defaultOpen>
    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5" />
        <h3 className="font-semibold">Einfluss-Techniken</h3>
        <Badge>{selectedTechniques.length} ausgewählt</Badge>
      </div>
      <ChevronDown className="h-4 w-4" />
    </CollapsibleTrigger>
    <CollapsibleContent className="pt-4">
      <div className="flex gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={selectAllTechniques}>
          Alle auswählen
        </Button>
        <Button variant="outline" size="sm" onClick={clearTechniques}>
          Keine
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {techniques.map(tech => (
          <TechniqueCard key={tech.id} technique={tech} />
        ))}
      </div>
    </CollapsibleContent>
  </Collapsible>

  <Collapsible defaultOpen>
    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5" />
        <h3 className="font-semibold">Taktiken</h3>
        <Badge>{selectedTactics.length} ausgewählt</Badge>
      </div>
      <ChevronDown className="h-4 w-4" />
    </CollapsibleTrigger>
    <CollapsibleContent className="pt-4">
      {/* Wie Techniken */}
    </CollapsibleContent>
  </Collapsible>

  {/* Prompt-Kontext */}
  <FormField name="strategy.productMarketDescription" />
  <VoiceInput />  {/* WICHTIG */}
</Section>
```

##### **Schritt 4: Zusammenfassung & Start**
Kompakte Übersicht + Simulation starten
```typescript
<Section title="Bereit zum Start">
  {/* Kompakte Summary-Cards */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <SummaryCard label="Produkte" value={products.length} />
    <SummaryCard label="Dimensionen" value={dimensions.length} />
    <SummaryCard label="Techniken" value={selectedTechniques.length} />
    <SummaryCard label="Taktiken" value={selectedTactics.length} />
  </div>

  {/* Detaillierte Übersicht als Collapsible */}
  <Collapsible>
    <CollapsibleTrigger>
      <Button variant="ghost">
        Details anzeigen <ChevronDown />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {/* Aktueller SummaryStep Content */}
    </CollapsibleContent>
  </Collapsible>

  {/* Actions */}
  <div className="flex gap-4 justify-end">
    <Button variant="outline">
      Speichern ohne Start
    </Button>
    <Button type="submit" size="lg">
      Simulation starten
      <Play className="ml-2" />
    </Button>
  </div>
</Section>
```

#### 2.2 Optische Verbesserungen

**Datei:** `client/src/components/CreateNegotiationForm.tsx`

##### Step Indicator kompakter
```typescript
// ALT: Alle Schritte als Badges
<Badge>1. Unternehmen</Badge>
<Badge>2. Markt</Badge>
// ... (7 Badges)

// NEU: Progress Bar + aktueller Schritt
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium">Schritt {currentStep + 1} von 4</span>
    <span className="text-muted-foreground">{steps[currentStep].label}</span>
  </div>
  <Progress value={(currentStep + 1) / 4 * 100} />
</div>
```

##### Voice-Input prominenter
```typescript
// ALT: Kleine Buttons am Feldende
<VoiceInput onTranscript={...} />

// NEU: Integrated in FormField mit Icon
<FormField name="description">
  <div className="relative">
    <Textarea {...field} />
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="absolute top-2 right-2"
      onClick={startVoiceInput}
    >
      <Mic className="h-4 w-4" />
      Sprechen
    </Button>
  </div>
  <VoiceInputInfo />
</FormField>
```

##### Markt-Insights nach Input
```typescript
// Reihenfolge anpassen:
<FormField name="market.intelligence" />
<VoiceInput />

{/* DANN erst Insights-Panel */}
<div className="mt-6">
  <MarketInsightsPanel />
</div>
```

**Dateien:**
- `client/src/components/CreateNegotiationForm.tsx` - Hauptlogik umbauen
- `client/src/components/create/StepIndicator.tsx` - NEU: Progress Bar
- `client/src/components/create/BasisStep.tsx` - NEU: Schritt 1
- `client/src/components/create/ProductsDimensionsStep.tsx` - NEU: Schritt 2
- `client/src/components/create/StrategyStep.tsx` - Umgebaut mit Collapsibles
- `client/src/components/create/SummaryStep.tsx` - Kompakter

---

### 📊 PHASE 3: Monitoring fokussieren
**Ziel:** Essentials hervorheben, Run-Vergleich auslagern

#### 3.1 Layout vereinfachen
**Datei:** `client/src/pages/negotiation-monitor.tsx`

**ALT (aktuell):**
```typescript
<MonitorHero />
<SimulationQueueOverview />
<div className="grid lg:grid-cols-3">
  <ActiveRunsTable /> {/* 2/3 */}
  <LiveActivityFeed /> {/* 1/3 */}
</div>
<RunComparisonCard /> {/* Komplex, 200+ Zeilen */}
```

**NEU (fokussiert):**
```typescript
<MonitorHero
  stats={queueStats}
  actions={
    <div className="flex gap-2">
      <Button onClick={refresh}>Aktualisieren</Button>
      <Button variant="destructive" onClick={stopAll}>
        Alle stoppen
      </Button>
    </div>
  }
/>

{/* Hauptfokus: Queue Status */}
<SimulationQueueOverview
  {...queueStats}
  estimatedTimeRemaining={estimatedTime}
/>

{/* Layout: Runs dominanter */}
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <div className="lg:col-span-3">
    <ActiveRunsTable
      runs={enrichedRuns}
      onSelectRun={(runId) => setSelectedRun(runId)}
    />
  </div>

  <div className="lg:col-span-1">
    <LiveActivityFeed events={activityEvents} />
  </div>
</div>

{/* CTA zu Analysis (nur wenn completed) */}
{negotiation.status === 'completed' && (
  <AnalysisCTA negotiationId={negotiationId} />
)}

{/* Run-Vergleich ENTFERNT - jetzt in Analysis */}
```

#### 3.2 Active Runs Table optimieren
**Datei:** `client/src/components/monitor/ActiveRunsTable.tsx`

- Kompaktere Darstellung
- Wichtigste Infos: Status, Technik×Taktik, Runde, Deal Value
- Row click → Run Details Modal (statt Inline-Expansion)

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Status</TableHead>
      <TableHead>Kombination</TableHead>
      <TableHead>Fortschritt</TableHead>
      <TableHead>Deal Value</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {runs.map(run => (
      <TableRow
        key={run.id}
        className="cursor-pointer hover:bg-muted"
        onClick={() => setSelectedRun(run)}
      >
        <TableCell>
          <StatusBadge status={run.status} />
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {run.techniqueName}
            </p>
            <p className="text-xs text-muted-foreground">
              {run.tacticName}
            </p>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            <Progress value={run.currentRound / run.maxRounds * 100} />
            <p className="text-xs text-muted-foreground">
              Runde {run.currentRound}/{run.maxRounds}
            </p>
          </div>
        </TableCell>
        <TableCell className="font-semibold">
          {formatCurrency(run.dealValue)}
        </TableCell>
        <TableCell>
          {run.status === 'running' && (
            <Button size="sm" variant="ghost">
              <Square className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>

{/* Run Details Modal */}
<RunDetailsModal
  run={selectedRun}
  open={!!selectedRun}
  onClose={() => setSelectedRun(null)}
/>
```

#### 3.3 Run-Vergleich zu Analysis verschieben
**Entfernen aus:** `client/src/pages/negotiation-monitor.tsx` (Zeilen 493-607)
**Verschieben nach:** `client/src/pages/analysis-view.tsx` (Phase 4)

**Dateien:**
- `client/src/pages/negotiation-monitor.tsx` - Layout vereinfachen, Run-Vergleich entfernen
- `client/src/components/monitor/ActiveRunsTable.tsx` - Kompakter
- `client/src/components/monitor/RunDetailsModal.tsx` - NEU: Details on click
- `client/src/components/monitor/AnalysisCTA.tsx` - NEU: Call-to-Action Card

---

### 🔬 PHASE 4: Analytics-Bereich ausbauen
**Ziel:** 3 Hauptfeatures implementieren

#### 4.1 Neue Analytics-Struktur
**Datei (neu):** `client/src/pages/analysis-view.tsx`

```typescript
export default function AnalysisView() {
  const [, params] = useRoute("/negotiations/:id/analysis");
  const negotiationId = params?.id;

  return (
    <div className="space-y-6">
      <AnalysisHero negotiation={negotiation} />

      {/* Tab-Navigation für 3 Bereiche */}
      <Tabs defaultValue="comparison">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">
            <BarChart3 className="mr-2 h-4 w-4" />
            Run-Vergleich
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="mr-2 h-4 w-4" />
            AI-Insights
          </TabsTrigger>
          <TabsTrigger value="playbook">
            <BookOpen className="mr-2 h-4 w-4" />
            Lektionen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison">
          <RunComparisonView runs={completedRuns} />
        </TabsContent>

        <TabsContent value="insights">
          <AIInsightsView negotiationId={negotiationId} />
        </TabsContent>

        <TabsContent value="playbook">
          <PlaybookPreview negotiationId={negotiationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 4.2 Feature 1: Strukturierter Run-Vergleich
**Datei:** `client/src/components/analysis/RunComparisonView.tsx`

**Aus Monitoring übernommen + erweitert:**
```typescript
export function RunComparisonView({ runs }: { runs: SimulationRun[] }) {
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'radar' | 'table' | 'timeline'>('radar');

  return (
    <div className="space-y-6">
      {/* Run-Auswahl */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Runs auswählen</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={selectTop3}>
                Top 3
              </Button>
              <Button size="sm" onClick={selectAll}>
                Alle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {runs.map(run => (
              <RunSelectionCard
                key={run.id}
                run={run}
                selected={selectedRuns.includes(run.id)}
                onToggle={() => toggleRun(run.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Vergleichsmodus */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vergleich ({selectedRuns.length} Runs)</CardTitle>
            <Tabs value={comparisonMode} onValueChange={setComparisonMode}>
              <TabsList>
                <TabsTrigger value="radar">Radar</TabsTrigger>
                <TabsTrigger value="table">Tabelle</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {comparisonMode === 'radar' && (
            <RadarComparisonChart runs={selectedRuns} />
          )}
          {comparisonMode === 'table' && (
            <ComparisonTable runs={selectedRuns} />
          )}
          {comparisonMode === 'timeline' && (
            <DimensionTimelineChart runs={selectedRuns} />
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Ø Deal Value"
          value={formatCurrency(avgDealValue)}
          trend={dealValueTrend}
        />
        <StatCard
          label="Ø Runden"
          value={avgRounds}
          trend={roundsTrend}
        />
        <StatCard
          label="Erfolgsrate"
          value={formatPercent(successRate)}
          trend={successRateTrend}
        />
        <StatCard
          label="Ø Dimensionserfolg"
          value={formatPercent(avgDimensionSuccess)}
          trend={dimensionTrend}
        />
      </div>
    </div>
  );
}
```

#### 4.3 Feature 2: AI-Insights (Automatisch nach Run-Ende)
**Datei:** `client/src/components/analysis/AIInsightsView.tsx`

**Backend-Trigger:**
```typescript
// server/services/simulation-result-processor.ts
// Nach jedem Run:
export async function processSimulationResult(runId: string) {
  // ... existing processing ...

  // AI-Evaluation automatisch triggern
  await generateAIEvaluation(runId);
}
```

**Frontend-Anzeige:**
```typescript
export function AIInsightsView({ negotiationId }: { negotiationId: string }) {
  const { data: insights, isLoading } = useQuery({
    queryKey: [`/api/negotiations/${negotiationId}/ai-insights`],
  });

  return (
    <div className="space-y-6">
      {/* Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Bewertung
          </CardTitle>
          <CardDescription>
            Automatische Analyse aller {insights?.totalRuns} Runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard
              icon={TrendingUp}
              label="Beste Strategien"
              items={insights?.topStrategies}
            />
            <InsightCard
              icon={AlertTriangle}
              label="Problematische Kombinationen"
              items={insights?.poorPerformers}
              variant="warning"
            />
            <InsightCard
              icon={Lightbulb}
              label="Empfehlungen"
              items={insights?.recommendations}
              variant="info"
            />
          </div>
        </CardContent>
      </Card>

      {/* Detaillierte Run-Bewertungen */}
      <Card>
        <CardHeader>
          <CardTitle>Run-Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple">
            {insights?.runEvaluations.map((evaluation, index) => (
              <AccordionItem key={evaluation.runId} value={`run-${index}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={getPerformanceBadgeVariant(evaluation.score)}>
                        Score: {evaluation.score}/100
                      </Badge>
                      <span className="font-medium">
                        {evaluation.techniqueName} × {evaluation.tacticName}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(evaluation.dealValue)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    {/* Taktische Zusammenfassung */}
                    <div>
                      <h4 className="font-semibold mb-2">Taktische Analyse</h4>
                      <p className="text-sm text-muted-foreground">
                        {evaluation.tacticalSummary}
                      </p>
                    </div>

                    {/* Effektivität */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Technik-Effektivität
                        </p>
                        <Progress
                          value={evaluation.techniqueEffectivenessScore}
                          className="h-2"
                        />
                        <p className="text-xs mt-1">
                          {evaluation.techniqueEffectivenessScore}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Taktik-Effektivität
                        </p>
                        <Progress
                          value={evaluation.tacticEffectivenessScore}
                          className="h-2"
                        />
                        <p className="text-xs mt-1">
                          {evaluation.tacticEffectivenessScore}%
                        </p>
                      </div>
                    </div>

                    {/* Dimensionen-Performance */}
                    <div>
                      <h4 className="font-semibold mb-2">Dimensionen</h4>
                      <div className="space-y-2">
                        {evaluation.dimensionResults?.map(dim => (
                          <div key={dim.dimensionName} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              {dim.achievedTarget ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-sm">{dim.dimensionName}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {dim.finalValue} (Ziel: {dim.targetValue})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Aggregierte Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Muster & Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights?.patterns.map((pattern, index) => (
              <div key={index} className="border-l-4 border-primary pl-4">
                <h4 className="font-semibold">{pattern.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {pattern.description}
                </p>
                {pattern.examples && (
                  <ul className="mt-2 space-y-1">
                    {pattern.examples.map((example, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        • {example}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Backend-Endpoint:**
```typescript
// server/routes/negotiations.ts
app.get("/api/negotiations/:id/ai-insights", async (req, res) => {
  const { id } = req.params;

  // Alle Runs mit AI-Evaluations laden
  const runs = await db.query.simulationRuns.findMany({
    where: eq(simulationRuns.negotiationId, id),
    with: {
      aiEvaluation: true,
    },
  });

  // Aggregierte Insights berechnen
  const insights = await aggregateInsights(runs);

  res.json(insights);
});
```

#### 4.4 Feature 3: Playbook (Kernlektionen)
**Datei:** `client/src/pages/playbook-view.tsx`

**Globale Playbook-Seite (über alle Verhandlungen):**
```typescript
export default function PlaybookView() {
  const { data: playbook, isLoading } = useQuery({
    queryKey: ['/api/playbook'],
  });

  return (
    <div className="space-y-6">
      <PlaybookHero
        title="Verhandlungs-Playbook"
        description="Kernlektionen und Best Practices aus allen Simulationen"
        stats={{
          totalNegotiations: playbook?.totalNegotiations,
          totalRuns: playbook?.totalRuns,
          lastUpdated: playbook?.lastUpdated,
        }}
      />

      {/* Kategorien */}
      <Tabs defaultValue="techniques">
        <TabsList>
          <TabsTrigger value="techniques">Techniken</TabsTrigger>
          <TabsTrigger value="tactics">Taktiken</TabsTrigger>
          <TabsTrigger value="combinations">Kombinationen</TabsTrigger>
          <TabsTrigger value="contexts">Kontexte</TabsTrigger>
        </TabsList>

        <TabsContent value="techniques">
          <TechniquesPlaybook lessons={playbook?.techniqueLessons} />
        </TabsContent>

        <TabsContent value="tactics">
          <TacticsPlaybook lessons={playbook?.tacticLessons} />
        </TabsContent>

        <TabsContent value="combinations">
          <CombinationsPlaybook lessons={playbook?.combinationLessons} />
        </TabsContent>

        <TabsContent value="contexts">
          <ContextsPlaybook lessons={playbook?.contextLessons} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Komponenten:**
```typescript
// client/src/components/playbook/TechniquesPlaybook.tsx
export function TechniquesPlaybook({ lessons }: { lessons: TechniqueLesson[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {lessons.map(lesson => (
        <Card key={lesson.techniqueId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{lesson.techniqueName}</CardTitle>
              <Badge variant={getPerformanceBadge(lesson.avgScore)}>
                Ø Score: {lesson.avgScore}/100
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Performance-Übersicht */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{lesson.timesUsed}</p>
                <p className="text-xs text-muted-foreground">Einsätze</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {lesson.successRate}%
                </p>
                <p className="text-xs text-muted-foreground">Erfolgsrate</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(lesson.avgDealValue)}
                </p>
                <p className="text-xs text-muted-foreground">Ø Deal Value</p>
              </div>
            </div>

            {/* Kernlektionen */}
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
                Kernlektionen
              </h4>
              <ul className="space-y-2">
                {lesson.keyLearnings.map((learning, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-primary font-semibold">•</span>
                    <span>{learning}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Beste Kombination */}
            <div>
              <h4 className="font-semibold mb-2">Beste Kombination</h4>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <span className="text-sm">{lesson.bestTacticPairing}</span>
                <Badge variant="success">
                  {formatCurrency(lesson.bestPairingDealValue)}
                </Badge>
              </div>
            </div>

            {/* Wann vermeiden */}
            {lesson.avoidContexts && lesson.avoidContexts.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Vermeiden bei
                </h4>
                <ul className="space-y-1">
                  {lesson.avoidContexts.map((context, index) => (
                    <li key={index} className="text-sm text-red-600">
                      • {context}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Backend-Endpoint:**
```typescript
// server/routes/playbook.ts
app.get("/api/playbook", async (req, res) => {
  // Alle Runs mit Evaluations laden
  const runs = await db.query.simulationRuns.findMany({
    where: eq(simulationRuns.status, 'completed'),
    with: {
      aiEvaluation: true,
      negotiation: true,
    },
  });

  // Aggregierte Lektionen generieren
  const playbook = {
    totalNegotiations: uniqueNegotiations(runs).length,
    totalRuns: runs.length,
    lastUpdated: new Date(),

    techniqueLessons: aggregateTechniqueLessons(runs),
    tacticLessons: aggregateTacticLessons(runs),
    combinationLessons: aggregateCombinationLessons(runs),
    contextLessons: aggregateContextLessons(runs),
  };

  res.json(playbook);
});

// Helper-Funktion
function aggregateTechniqueLessons(runs: SimulationRun[]) {
  const groupedByTechnique = groupBy(runs, 'techniqueId');

  return Object.entries(groupedByTechnique).map(([techniqueId, techniqueRuns]) => {
    const avgScore = average(techniqueRuns.map(r => r.aiEvaluation?.score || 0));
    const successRate = (techniqueRuns.filter(r => r.outcome === 'success').length / techniqueRuns.length) * 100;

    // AI-generierte Lektionen aus Evaluations extrahieren
    const keyLearnings = extractKeyLearnings(techniqueRuns);

    // Beste Taktik-Paarung finden
    const pairings = groupBy(techniqueRuns, 'tacticId');
    const bestPairing = Object.entries(pairings)
      .map(([tacticId, pairingRuns]) => ({
        tacticId,
        tacticName: pairingRuns[0].tacticName,
        avgDealValue: average(pairingRuns.map(r => r.dealValue)),
      }))
      .sort((a, b) => b.avgDealValue - a.avgDealValue)[0];

    return {
      techniqueId,
      techniqueName: techniqueRuns[0].techniqueName,
      timesUsed: techniqueRuns.length,
      avgScore,
      successRate,
      avgDealValue: average(techniqueRuns.map(r => r.dealValue)),
      keyLearnings,
      bestTacticPairing: bestPairing.tacticName,
      bestPairingDealValue: bestPairing.avgDealValue,
      avoidContexts: findProblematicContexts(techniqueRuns),
    };
  });
}
```

**Dateien:**
- `client/src/pages/analysis-view.tsx` - NEU: Haupt-Analyse mit Tabs
- `client/src/components/analysis/RunComparisonView.tsx` - Aus Monitor verschoben + erweitert
- `client/src/components/analysis/AIInsightsView.tsx` - NEU: AI-Bewertungen
- `client/src/pages/playbook-view.tsx` - NEU: Globales Playbook
- `client/src/components/playbook/TechniquesPlaybook.tsx` - NEU
- `client/src/components/playbook/TacticsPlaybook.tsx` - NEU
- `client/src/components/playbook/CombinationsPlaybook.tsx` - NEU
- `server/routes/playbook.ts` - NEU: Backend-Logik
- `server/services/playbook-generator.ts` - NEU: Aggregation-Logik

---

## 🎯 Zusammenfassung der Änderungen

### Routing
| Alt | Neu | Zweck |
|-----|-----|-------|
| `/` → Negotiations | `/` → Dashboard | Dashboard First ✅ |
| `/negotiations` | `/negotiations` | Liste (vereinfacht) |
| `/monitor/:id` | `/negotiations/:id` | Monitoring-Fokus ✅ |
| `/analysis/:id` | `/negotiations/:id/analysis` | Erweiterte Analyse ✅ |
| - | `/playbook` | NEU: Kernlektionen ✅ |

### Create-Flow
| Alt | Neu |
|-----|-----|
| 7 Schritte | 4 Schritte ✅ |
| Techniken/Taktiken: Liste | Collapsible Sections ✅ |
| Markt-Insights vor Feldern | Nach Input-Feldern ✅ |

### Monitoring
| Alt | Neu |
|-----|-----|
| Queue + Runs + Feed + Vergleich | Queue + Runs + Feed ✅ |
| Run-Vergleich inline | → Analysis ✅ |

### Analytics (NEU)
1. **Run-Vergleich** - Aus Monitoring + erweitert
2. **AI-Insights** - Automatisch nach jedem Run
3. **Playbook** - Globale Kernlektionen

---

## 📦 Implementierungs-Reihenfolge

### Sprint 1 (Foundation)
- [ ] PHASE 1: Routing & Navigation
  - Routing umstellen
  - Sidebar vereinfachen
  - Dashboard als Landing
  - Monitor → negotiations/:id

### Sprint 2 (UX Improvements)
- [ ] PHASE 2: Create-Flow
  - 7→4 Schritte konsolidieren
  - Collapsibles für Techniken/Taktiken
  - Voice-Input optimieren
  - Markt-Insights-Reihenfolge

### Sprint 3 (Monitoring)
- [ ] PHASE 3: Monitoring fokussieren
  - Layout vereinfachen
  - Run-Vergleich entfernen
  - ActiveRunsTable optimieren
  - Analysis-CTA hinzufügen

### Sprint 4 (Analytics)
- [ ] PHASE 4.1: Run-Vergleich
  - Komponente aus Monitor verschieben
  - Radar/Table/Timeline Modi
  - Selection-System

### Sprint 5 (AI Features)
- [ ] PHASE 4.2: AI-Insights
  - Backend: Auto-Evaluation nach Run
  - Frontend: Insights-View
  - Aggregierte Patterns

### Sprint 6 (Playbook)
- [ ] PHASE 4.3: Playbook
  - Backend: Aggregation-Logik
  - Frontend: Playbook-Seite
  - Techniken/Taktiken/Kombinationen

---

## 🧪 Testing-Checkliste

### Routing
- [ ] `/` führt zu Dashboard
- [ ] Dashboard zeigt Metriken korrekt
- [ ] "Neue Verhandlung" Button funktioniert
- [ ] `/negotiations` zeigt Liste
- [ ] Klick auf Verhandlung → `/negotiations/:id`
- [ ] Monitor zeigt Live-Updates
- [ ] "Zur Analyse" nur bei completed
- [ ] Analysis-Route funktioniert
- [ ] Playbook-Route funktioniert

### Create-Flow
- [ ] Schritt 1: Alle Felder validieren
- [ ] Schritt 2: Produkte/Dimensionen hinzufügen
- [ ] Schritt 3: Techniken/Taktiken Collapsibles
- [ ] Schritt 4: Zusammenfassung korrekt
- [ ] Voice-Input in allen relevanten Feldern
- [ ] Markt-Insights nach Feldern
- [ ] Speichern & Starten funktioniert

### Monitoring
- [ ] WebSocket-Verbindung
- [ ] Queue-Status aktualisiert
- [ ] Active Runs Updates
- [ ] Live Feed Events
- [ ] Run Details Modal
- [ ] Stop-Funktionen
- [ ] Analysis-CTA bei completed

### Analytics
- [ ] Run-Auswahl funktioniert
- [ ] Radar-Chart korrekt
- [ ] Table-View vollständig
- [ ] Timeline-Chart zeigt Progression
- [ ] AI-Insights laden
- [ ] Accordion-Details
- [ ] Playbook-Daten aggregiert
- [ ] Cross-Negotiation Vergleich

---

## 📚 Komponenten-Struktur (neu)

```
client/src/
├── pages/
│   ├── dashboard.tsx                    # Landing (Dashboard First)
│   ├── negotiations-list.tsx            # Übersichtstabelle
│   ├── negotiation-monitor.tsx          # Monitoring (war monitor.tsx)
│   ├── analysis-view.tsx                # NEU: Erweiterte Analyse
│   ├── playbook-view.tsx                # NEU: Globales Playbook
│   └── create-negotiation.tsx           # Wrapper für Form
│
├── components/
│   ├── create/
│   │   ├── BasisStep.tsx                # NEU: Schritt 1 (Basis-Infos)
│   │   ├── ProductsDimensionsStep.tsx   # NEU: Schritt 2 (konsolidiert)
│   │   ├── StrategyStep.tsx             # Umgebaut (Collapsibles)
│   │   ├── SummaryStep.tsx              # Kompakter
│   │   └── StepIndicator.tsx            # NEU: Progress Bar
│   │
│   ├── monitor/
│   │   ├── SimulationQueueOverview.tsx  # Behalten
│   │   ├── ActiveRunsTable.tsx          # Optimiert
│   │   ├── LiveActivityFeed.tsx         # Behalten
│   │   ├── RunDetailsModal.tsx          # NEU: Details on click
│   │   └── AnalysisCTA.tsx              # NEU: Call-to-Action
│   │
│   ├── analysis/
│   │   ├── RunComparisonView.tsx        # Aus Monitor verschoben
│   │   ├── RadarComparisonChart.tsx     # Behalten
│   │   ├── ComparisonTable.tsx          # NEU
│   │   ├── DimensionTimelineChart.tsx   # NEU
│   │   ├── AIInsightsView.tsx           # NEU: AI-Bewertungen
│   │   └── RunEvaluationCard.tsx        # NEU
│   │
│   ├── playbook/
│   │   ├── TechniquesPlaybook.tsx       # NEU
│   │   ├── TacticsPlaybook.tsx          # NEU
│   │   ├── CombinationsPlaybook.tsx     # NEU
│   │   ├── ContextsPlaybook.tsx         # NEU
│   │   └── LessonCard.tsx               # NEU
│   │
│   └── layout/
│       ├── sidebar.tsx                  # Vereinfacht
│       ├── header.tsx                   # Behalten
│       └── PageHero.tsx                 # NEU: Gemeinsame Hero
│
└── hooks/
    ├── use-negotiations.ts              # Behalten
    ├── use-negotiation-detail.ts        # Behalten
    ├── use-playbook.ts                  # NEU
    └── use-ai-insights.ts               # NEU
```

---

## 🔧 Backend-Änderungen

### Neue Endpoints
```typescript
// AI-Evaluation automatisch
POST /api/simulations/runs/:id/complete
→ Triggert automatisch AI-Evaluation

// Insights
GET /api/negotiations/:id/ai-insights
→ Aggregierte AI-Bewertungen

// Playbook
GET /api/playbook
→ Globale Lektionen

GET /api/playbook/techniques/:techniqueId
→ Detail-Lektionen für Technik

GET /api/playbook/tactics/:tacticId
→ Detail-Lektionen für Taktik
```

### Services
```typescript
// server/services/
├── ai-evaluation.ts           # Bestehend, erweitert
├── playbook-generator.ts      # NEU: Aggregation
└── simulation-result-processor.ts  # Erweitert (Auto-Evaluation)
```

---

## ✅ Definition of Done

### PHASE 1 (Routing)
- [ ] Dashboard ist Landing Page (/)
- [ ] Navigation in Sidebar vereinfacht
- [ ] Alle Routes funktionieren
- [ ] Breadcrumbs korrekt
- [ ] Keine 404-Fehler

### PHASE 2 (Create-Flow)
- [ ] 4 statt 7 Schritte
- [ ] Collapsibles für Techniken/Taktiken
- [ ] Voice-Input funktioniert
- [ ] Markt-Insights-Reihenfolge korrekt
- [ ] Validierung funktioniert
- [ ] Form speichert korrekt

### PHASE 3 (Monitoring)
- [ ] Layout fokussiert
- [ ] Run-Vergleich entfernt
- [ ] WebSocket funktioniert
- [ ] Live-Updates korrekt
- [ ] Analysis-CTA sichtbar bei completed

### PHASE 4 (Analytics)
- [ ] Run-Vergleich in Analysis funktioniert
- [ ] AI-Insights automatisch generiert
- [ ] Playbook zeigt Daten
- [ ] Alle 3 Tabs funktionieren
- [ ] Cross-Negotiation Vergleich möglich

---

Möchtest du mit Phase 1 (Routing & Navigation) beginnen? Das ist die Foundation für alles weitere.
