# Frontend Redesign Task

Please implement the following "Modern & Sophisticated" redesign for the frontend application.

## 1. Corporate Identity & Theme
Update `client/src/index.css` to use the following color palette (convert to HSL for Tailwind variables):

*   **Primary (Navy):** `#102C5D` (Deep Navy/Oxford Blue) - Main brand color.
*   **Destructive/Accent (Red):** `#DC372C` (Vibrant Red) - For alerts, "Walk Away", and high-priority actions.
*   **Warning/Accent (Yellow):** `#EBD533` (Mustard/Gold) - For warnings or highlights.
*   **Neutrals:** Replace standard Gray with **Slate** (cool gray) for a more premium technical feel.

**Style Adjustments:**
*   **Radius:** Ensure a consistent, moderate radius (e.g., `0.5rem`) for cards and buttons.
*   **Shadows:** Use subtle shadows (`shadow-sm`) combined with crisp borders (`border-slate-200`) instead of heavy drop shadows.

## 2. Layout Refinement
**Sidebar (`client/src/components/layout/sidebar.tsx`):**
*   Remove the heavy `shadow-lg`.
*   Add a clean right border: `border-r border-slate-200`.
*   **Active State:** Instead of a high-contrast fill, use a subtle wash (e.g., `bg-primary/5` or `text-primary` with a left border strip).
*   Background: White or very light slate (`bg-slate-50/50`).

**App Shell (`client/src/App.tsx`):**
*   Ensure the main background is a clean off-white (e.g., `bg-slate-50/50`) to let white cards pop.

## 3. Dashboard Modernization (`client/src/pages/dashboard.tsx`)
*   **Hero Section:** Remove the large gradient box. Replace it with a minimal **Page Header**:
    *   **Title:** "Dashboard" (Large, Bold, Navy)
    *   **Subtitle:** "Overview of your negotiation simulations" (Slate-500)
    *   **Actions:** Place primary actions (like "New Negotiation") in the top right.
*   **Metrics Cards (`client/src/components/dashboard/metrics-cards.tsx`):**
    *   Redesign for minimalism.
    *   Remove large colored icon squares.
    *   Layout: Label (top left, Slate), Value (big, bold, Navy), Trend/Icon (subtle, bottom or top right).
*   **Live Negotiations (`client/src/components/dashboard/live-negotiations.tsx`):**
    *   Convert custom status badges to use the standard Shadcn `<Badge>` component.
    *   Style: Minimal list view with `border-b` separators instead of separate gray boxes.

## 4. Component Standardization
*   **Buttons:** Ensure primary buttons use the new Navy color.
*   **Cards:** Enforce `border border-slate-200 shadow-sm` on all cards.
*   **Typography:** Use `Inter` (or default sans) with careful weight distribution (Bold for headers, Regular for body, Medium for interactive elements).

## Implementation Steps
1.  Update `client/src/index.css` with new HSL color variables.
2.  Refactor `Sidebar` component.
3.  Refactor `Dashboard` page layout.
4.  Update `MetricsCards` component.
5.  Update `LiveNegotiations` component.
