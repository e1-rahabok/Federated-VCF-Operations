# AGENTS.md - Universal AI Agent & Developer Guidelines

This repository contains the **Federated VMware Cloud Foundation (VCF) Operations 9** application.
All AI agents, coding assistants, and human developers working in this codebase must strictly observe these instructions across all environments, IDEs, and workstations.

---

## Non-Negotiable Core Principles

### 1. Zero-Mocks & Real Data Flow
- **No Dummy Mocks**: Static HTML table rows, hardcoded mock numbers, simulated `Math.sin()` or `Math.random()` datasets, and placeholder `alert()` popups are strictly prohibited.
- **Real Database & Configuration Backing**:
  - All VCF instances, monitored objects, and alerts MUST be stored in and queried from the SQLite database (`data/federated_ops.db` via `node:sqlite`).
  - All telemetry metrics and alert filters MUST be read from and persisted to `Configuration/metrics_list.yaml` and `Configuration/alerts_list.yaml`.
  - Chart series must query `/api/v1/metrics/query` with real timeseries records.
- **Real Actions & Exports**:
  - Export CSV buttons must generate actual CSV file downloads via `Blob` and `URL.createObjectURL`.
  - Save/Update/Delete buttons must send real REST API requests and update UI state.

### 2. High-Fidelity Integration Testing
- Do NOT write superficial tests that only check `res.status === 200` or check for empty container divs.
- Every integration test MUST execute a complete data lifecycle:
  1. Insert/mutate data in SQLite or YAML.
  2. Invoke API or execute client view code in virtual DOM.
  3. Assert that the mutated record appears in the API response and DOM table/chart elements.

### 3. Architecture & Code Cleanliness
- Backend routes, models, ingestion scheduler, and database logic live under `src/backend/`.
- Frontend components, pages, and hooks live under `src/frontend/`.
- Embedded server template literals must never contain raw backslash regexes (`\s`, `\n`) that degrade during string interpolation. Prefer clean string methods (`indexOf`, `substring`, `trim`).

### 4. Milestone Checkpoint Audits
Before completing any task, execute an anti-mocking audit:
- [ ] Are all tables populated dynamically from API/database queries?
- [ ] Are all chart lines computed from actual timestamped metrics?
- [ ] Are all buttons wired to real HTTP requests or downloads?
- [ ] Do all automated tests assert actual business data?
