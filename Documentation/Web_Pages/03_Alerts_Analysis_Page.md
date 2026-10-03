# Page 3: Alerts Analysis Page

* **Route**: `/alerts`
* **Target Audience**: System Administrators and Incident Response Teams.
* **Primary Goal**: Provide multi-dimensional slicing and dicing of alerts across all connected VCF Operations instances.

---

## 📐 Visual Layout & Wireframe

```
+-----------------------------------------------------------------------------------------+
| FILTERS: [VCF Instance: All v] [Severity: Critical, Warning v] [Kind: VM, Host v] [Search]|
+-----------------------------------------------------+-----------------------------------+
| CHART 1: Alert Volume Timeline (Stacked Bar)        | CHART 2: Severity Breakdown (Donut|
| [=================== Timeline Chart =============]  | [ (C: 15%)(W: 65%)(I: 20%) Donut ]|
+-----------------------------------------------------+-----------------------------------+
| ALERTS DATA GRID (TanStack Table)                                                       |
| Severity | Instance    | Target Resource | Alert Name              | Triggered Time      |
|----------+-------------+-----------------+-------------------------+---------------------|
| CRITICAL | VCF-Ops-01  | Host-ESX-02     | Physical PSU Fault      | 2026-10-03 10:15 UTC|
| WARNING  | VCF-Ops-02  | VM-007          | High CPU Ready Latency  | 2026-10-03 10:18 UTC|
| ...                                                                                     |
+-----------------------------------------------------------------------------------------+
```

---

## ⚡ Key Functions & Controls

1. **Faceted Filter Toolbar**: Dropdowns for VCF Instance, Alert Severity (`CRITICAL`, `IMMEDIATE`, `WARNING`, `INFO`), Alert Status (`ACTIVE`, `CANCELED`), and Resource Kind.
2. **Instant Text Search Bar**: Real-time client-side filter searching table rows by alert name or target resource name.
3. **Interactive Timeline Chart**: Stacked bar chart rendering alert counts over time. Dragging a selection box zooms into that time window across the grid.
4. **Interactive Severity Donut**: Clicking a donut segment (e.g., `CRITICAL`) instantly filters the table below.
5. **Alert Data Grid**: Sortable columns, virtualized infinite scrolling, and CSV export action button.
6. **Row Click Action**: Opens Page 4 (`/alerts/:alertId`).

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/alerts`: Retrieves paginated alert list with query filters (`instance_id`, `severity`, `status`, `kind`, `search`, `begin`, `end`).
* `GET /api/v1/alerts/timeline`: Fetches aggregated alert counts bucketed by time interval.
