# Frontend Developer Guide & UI/UX Best Practices

This document defines the UI/UX design tokens, state management rules, frontend architecture patterns, and component guidelines for the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

# 1. Frontend Architecture & Technology Stack

The React 18 frontend is structured around modular single-responsibility components and robust state management.

| Layer | Selected Library / Tool | Engineering Purpose |
| :--- | :--- | :--- |
| **UI Framework** | React 18 (TypeScript) | Declarative UI rendering, component reusability. |
| **Styling & Design Tokens** | Tailwind CSS | Consistent design tokens, utility-first responsive styling. |
| **Component Primitives** | Shadcn UI (Radix UI primitives) | Accessible, unstyled component primitives (dialogs, dropdowns, tooltips). |
| **Data Fetching & Caching** | TanStack Query (React Query v5) | Server-state caching, stale-while-revalidate, optimistic updates. |
| **Global Client State** | Zustand | Lightweight client state for workspace filters and user layout preferences. |
| **Data Tables** | TanStack Table v8 + `@tanstack/react-virtual` | High-performance virtualized scrolling for 50,000+ data rows. |
| **Charting Engine** | Apache ECharts (`echarts-for-react`) | HTML5 Canvas rendering for high-density timeseries charts with 60 FPS zoom/pan. |

---

# 2. Design System Tokens & Severity Standards

## 2.1 Color Tokens & Dark/Light Mode Palette

To maintain visual consistency across dashboards, all colors are defined as Tailwind design tokens:

| Token Name | Hex Code | Visual Context |
| :--- | :--- | :--- |
| `--color-severity-critical` | `#ef4444` (Red 500) | `CRITICAL` alerts, host down, PSU hardware failure. |
| `--color-severity-immediate` | `#f97316` (Orange 500) | `IMMEDIATE` alerts, HA failover capacity compromised. |
| `--color-severity-warning` | `#f59e0b` (Amber 500) | `WARNING` alerts, high CPU/memory usage, datastore 90% full. |
| `--color-severity-info` | `#3b82f6` (Blue 500) | `INFO` alerts, DRS vMotion events, system notifications. |
| `--color-status-healthy` | `#22c55e` (Green 500) | Active polling health, normal resource capacity. |
| `--color-bg-workspace` | `#0f172a` (Slate 900) | Workspace background (Dark Theme default). |
| `--color-card-surface` | `#1e293b` (Slate 800) | Widget cards, table containers, modal dialogs. |

---

# 3. Universal 4-State Component Pattern

Every data-driven UI widget (chart, data grid, summary card) MUST explicitly implement the **Universal 4-State Machine Pattern**:

```
                  +-----------------------------------+
                  |  1. LOADING STATE                 |
                  |  - Skeleton Loader Overlay        |
                  |  - Non-blocking CSS shimmer       |
                  +-----------------+-----------------+
                                    |
            +-----------------------+-----------------------+
            | API Success (Data > 0)                        | API Error / Timeout
            v                                               v
+-----------------------+                       +-----------------------+
| 2. SUCCESS STATE      |                       | 3. ERROR STATE        |
| - Interactive Chart   |                       | - User-friendly message|
| - Virtualized Grid    |                       | - "Retry Action" Btn  |
+-----------+-----------+                       +-----------------------+
            |
            | API Success (Data == 0)
            v
+-----------------------+
| 4. EMPTY STATE        |
| - Zero-data illustration
| - Clear filters link  |
+-----------------------+
```

### State Design Requirements
1. **Loading State**: Render skeleton shimmer cards using Tailwind `animate-pulse`. Layout shifts (`CLS`) are prohibited.
2. **Success State**: Render interactive chart or data table with smooth entry animation.
3. **Error State**: Display a friendly alert box detailing the failure cause with a **"Retry Query"** button.
4. **Empty State**: When filters return 0 records, render a clear zero-state graphic with a **"Reset Filters"** action button.

---

# 4. Data Fetching, Caching & Performance Guidelines

## 4.1 Server State Caching with TanStack Query
* **Stale-Time Configuration**: Dashboard queries use `staleTime: 30000` (30 seconds) to prevent duplicate HTTP refetches when switching tabs.
* **Refetch on Tab Focus**: Automatically paused when the user switches browser tabs (`refetchOnWindowFocus: false`) to minimize server load.
* **Optimistic Updates**: Dashboard layout changes update UI state instantly before the backend mutation returns.

## 4.2 Chart Performance & Memory Management
* **Canvas Renderer**: ECharts components MUST use `renderer='canvas'` to handle tens of thousands of data points smoothly.
* **Debounced Resize Observer**: Chart containers listen to window resize events via a 150ms debounced observer to prevent layout thrashing:
  ```typescript
  import useResizeObserver from 'use-resize-observer';

  const MyChartComponent = () => {
    const { ref, width } = useResizeObserver({ debounce: 150 });
    // ECharts instance resizes cleanly when width changes
  };
  ```
* **Chart Clean-up**: ECharts instances MUST call `chart.dispose()` on unmount to prevent memory leaks.

## 4.3 Table Virtualization
* All tables displaying over 50 rows MUST use `@tanstack/react-virtual`.
* Only the visible viewport rows (plus a 5-row buffer) are rendered in the DOM. This keeps DOM node count below 200 elements regardless of dataset size (e.g. 50,000 alert rows).

---

# 5. External Launch Security & Accessibility (a11y)

## 5.1 Deep-Link Launch Security (`Open in VCF Operations`)
When opening external VCF Operations 9 or vCenter consoles in a new browser tab:
```typescript
const openVcfConsole = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};
```
* **Security Requirement**: `noopener,noreferrer` is mandatory to prevent reverse tabnabbing security vulnerabilities.

## 5.2 Accessibility & Keyboard Shortcuts
* All interactive chart elements, filter dropdowns, and modal dialogs MUST be focusable via `Tab`.
* Modal dialogs MUST close on `Escape` keypress.
* All visual charts MUST include `aria-label` screen reader descriptions.
