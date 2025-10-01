# ARIAN AI - Design System Specification

## Design Philosophy

**Focus**: Professional B2B negotiation simulation platform
**Approach**: Clean, data-driven interfaces that prioritize clarity and usability
**Target**: Business professionals who need to analyze negotiation effectiveness

---

## Visual Identity

### Color System
```css
/* Primary Brand Colors */
--primary: 239 68% 68%        /* #f97316 - Orange (negotiation energy) */
--primary-foreground: 0 0% 98% /* #fafafa */

/* Semantic Colors */
--success: 142 76% 36%        /* #16a34a - Green */
--warning: 48 96% 53%         /* #eab308 - Yellow */  
--destructive: 0 84% 60%      /* #ef4444 - Red */
--info: 221 83% 53%           /* #3b82f6 - Blue */

/* Neutral Palette */
--background: 0 0% 100%       /* #ffffff */
--foreground: 222 84% 5%      /* #09090b */
--muted: 210 40% 98%          /* #f8fafc */
--muted-foreground: 215 16% 47% /* #64748b */
--border: 214 32% 91%         /* #e2e8f0 */
--card: 0 0% 100%             /* #ffffff */
```

### Typography Scale
- **Headings**: Inter font family, semibold weights
- **Body**: Inter font family, regular weights  
- **Code/Data**: JetBrains Mono, monospace for data tables

```css
/* Typography System */
.text-h1 { font-size: 2.5rem; line-height: 1.2; font-weight: 600; }
.text-h2 { font-size: 2rem; line-height: 1.3; font-weight: 600; }
.text-h3 { font-size: 1.5rem; line-height: 1.4; font-weight: 600; }
.text-body { font-size: 1rem; line-height: 1.6; font-weight: 400; }
.text-caption { font-size: 0.875rem; line-height: 1.5; font-weight: 400; }
.text-small { font-size: 0.75rem; line-height: 1.4; font-weight: 400; }
```

### Spacing System
- **Base unit**: 4px (0.25rem)
- **Scale**: 4, 8, 12, 16, 24, 32, 48, 64, 96px
- **Grid**: 24px baseline for vertical rhythm

---

## Component Library Architecture

### Layout Components

#### 1. AppShell
```tsx
interface AppShell {
  sidebar: ReactNode;
  header: ReactNode;  
  main: ReactNode;
  backgroundColor?: "gray-50" | "white";
}
```

#### 2. PageContainer  
```tsx
interface PageContainer {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: "full" | "7xl" | "6xl";
}
```

### Navigation Components

#### 3. NavigationBar (4-Screen Focus)
```tsx
interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  isActive?: boolean;
}

const MAIN_NAVIGATION: NavigationItem[] = [
  { label: "Negotiations", href: "/negotiations", icon: HandMetal },
  { label: "Configure", href: "/configure", icon: Settings },
  { label: "Monitor", href: "/monitor", icon: Activity },
  { label: "Analysis", href: "/analysis", icon: BarChart3 }
];
```

### Data Display Components

#### 4. DataTable with Enhanced Features
```tsx
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  selection?: "single" | "multiple" | "none";
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
}
```

#### 5. StatCard (KPI Display)
```tsx
interface StatCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
    timeframe?: string;
  };
  icon?: LucideIcon;
  color?: "primary" | "success" | "warning" | "info";
}
```

#### 6. ProgressTracker (Simulation Status)
```tsx
interface ProgressTracker {
  total: number;
  completed: number;
  failed: number;
  running: number;
  showDetails?: boolean;
  variant?: "compact" | "detailed";
}
```

### Form Components

#### 7. WizardForm (Multi-Step Configuration)
```tsx
interface WizardStep {
  id: string;
  title: string;
  description?: string;
  component: ReactNode;
  validation?: ZodSchema;
  optional?: boolean;
}

interface WizardForm {
  steps: WizardStep[];
  initialData?: Record<string, any>;
  onComplete: (data: Record<string, any>) => void;
  onStepChange?: (stepIndex: number) => void;
}
```

#### 8. DimensionEditor (ZOPA Configuration)
```tsx
interface DimensionConfig {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;  
  targetValue: number;
  priority: 1 | 2 | 3;
  unit?: string;
}

interface DimensionEditor {
  dimensions: DimensionConfig[];
  onChange: (dimensions: DimensionConfig[]) => void;
  presets?: DimensionConfig[];
  maxDimensions?: number;
}
```

### Visualization Components  

#### 9. RadarChart (Negotiation Results)
```tsx
interface RadarChartProps {
  data: Array<{
    id: string;
    label: string;
    values: Record<string, number>;
    technique?: string;
    tactic?: string;
    color?: string;
  }>;
  dimensions: string[];
  interactive?: boolean;
  showLegend?: boolean;
  onLineClick?: (dataPoint: any) => void;
}
```

#### 10. ResultsMatrix (Technique × Tactic Performance)
```tsx
interface MatrixCell {
  technique: string;
  tactic: string;
  score: number;
  runs: number;
  status: "completed" | "running" | "failed" | "pending";
}

interface ResultsMatrix {
  data: MatrixCell[];
  techniques: string[];
  tactics: string[];
  onCellClick?: (cell: MatrixCell) => void;
}
```

---

## Screen-Specific Design Patterns

### Screen 1: Negotiation Management
- **Layout**: Card-based grid with search/filter bar
- **Primary Action**: Large "Create New Negotiation" button
- **Status Indicators**: Color-coded badges (configured, running, completed, error)
- **Data Density**: Compact table view with expandable details

### Screen 2: Configuration Wizard  
- **Layout**: Left sidebar progress + main form area
- **Navigation**: Clear step indicators with validation status
- **Form Groups**: Collapsible sections for complex configurations
- **Preview**: Real-time calculation panel showing run count/cost

### Screen 3: Simulation Monitoring
- **Layout**: Header status + dual-pane (chart + table)
- **Real-time**: WebSocket updates with smooth animations
- **Interaction**: Drill-down from chart to detailed logs  
- **Controls**: Prominent start/pause/stop controls

### Screen 4: Cross-Negotiation Analysis
- **Layout**: Dashboard-style with draggable panels
- **Visualizations**: Multiple chart types with consistent styling
- **Filtering**: Advanced filter sidebar with saved views
- **Export**: Clear export options for reports/data

---

## Responsive Design Rules

### Breakpoints
```css
/* Mobile First Approach */
sm: '640px',   /* Small tablets */
md: '768px',   /* Large tablets */
lg: '1024px',  /* Small desktops */
xl: '1280px',  /* Large desktops */
2xl: '1536px'  /* Ultra-wide */
```

### Mobile Adaptations
- **Navigation**: Collapsible sidebar → bottom tab bar
- **Tables**: Horizontal scroll + card view toggle
- **Forms**: Single column layout with larger touch targets
- **Charts**: Simplified view with zoom/pan gestures

---

## Animation & Interaction Guidelines

### Micro-Interactions
```css
/* Transition Standards */
.transition-fast { transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1); }
.transition-normal { transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1); }
.transition-slow { transition: all 500ms cubic-bezier(0.4, 0, 0.2, 1); }

/* Hover States */
.hover-lift { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.hover-scale { transform: scale(1.02); }
```

### Loading States
- **Cards**: Skeleton loaders matching content structure
- **Tables**: Progressive loading with placeholder rows
- **Charts**: Smooth data transitions, not abrupt replacements
- **Buttons**: Spinner + disabled state during actions

### Success/Error Feedback
- **Toast notifications** for non-critical updates
- **Inline validation** for form errors
- **Modal confirmations** for destructive actions
- **Progress indicators** for multi-step processes

---

## Data Visualization Standards

### Color Coding
- **Techniques**: Warm colors (oranges, reds, yellows)
- **Tactics**: Cool colors (blues, greens, purples)  
- **Performance**: Traffic light system (green > yellow > red)
- **Status**: Consistent semantic colors across all components

### Chart Guidelines
- **Radar Charts**: Max 8 lines for readability
- **Bar Charts**: Sorted by value unless temporal
- **Tables**: Zebra striping, hover highlighting
- **Trend Lines**: Clear directional indicators

### Data Density
- **High-level views**: Summary cards with key metrics
- **Detail views**: Full data tables with sorting/filtering
- **Drill-down**: Click interactions to reveal more detail
- **Context**: Always show data freshness/update times

---

## Accessibility Standards

### WCAG 2.1 AA Compliance
- **Color contrast**: Minimum 4.5:1 for normal text
- **Focus indicators**: Clear keyboard navigation paths
- **Screen readers**: Proper ARIA labels and descriptions
- **Touch targets**: Minimum 44px×44px clickable areas

### Keyboard Navigation
- **Tab order**: Logical flow through interactive elements
- **Shortcuts**: Common actions (Ctrl+N for new, etc.)
- **Modal management**: Focus trapping and restoration
- **Table navigation**: Arrow key support for data tables

---

## Implementation Strategy

### Phase 2A: Core Components (3 days)
1. **Layout System**: AppShell, PageContainer, enhanced Sidebar
2. **Data Display**: Enhanced DataTable, StatCard, ProgressTracker
3. **Navigation**: New 4-screen navigation structure

### Phase 2B: Form Components (2 days)  
4. **WizardForm**: Multi-step configuration system
5. **DimensionEditor**: ZOPA management interface
6. **Selection Components**: Technique/tactic pickers

### Phase 2C: Visualization (3 days)
7. **RadarChart**: Multi-line negotiation results display
8. **ResultsMatrix**: Technique×tactic performance grid
9. **Real-time Updates**: WebSocket integration patterns

---

## Success Metrics

### User Experience
- **Task completion**: Users can complete 4-screen workflow <5 minutes
- **Error rate**: <2% form validation errors
- **Performance**: Page loads <2 seconds, interactions <100ms response

### Visual Consistency  
- **Component reuse**: >80% of UI built from design system components
- **Color compliance**: 100% WCAG AA color contrast compliance
- **Responsive design**: Functional on all breakpoints

### Development Velocity
- **Component library**: Reusable components reduce development time by 40%
- **Documentation**: All components have usage examples and props documentation
- **Testing**: >90% component test coverage

---

**This design system prioritizes the 4-screen workflow while maintaining professional aesthetics and ensuring smooth user experience across all negotiation simulation tasks.**