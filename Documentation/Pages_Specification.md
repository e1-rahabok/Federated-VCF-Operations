# Pages Specification Document

This document defines the page inventory, visual layouts, key functions, API dependencies, and user interaction design for all web pages in the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

# 1. Page Inventory & Navigation Sitemap

```
/ (Root)
│
├── /login                         [Page 1: User Login Page]
│
├── /                              [Page 2: Personalized Home Page]
│
├── /alerts                        [Page 3: Alerts Analysis Page]
│   └── /alerts/:alertId           [Page 4: Detail Alert Page]
│
├── /metrics                       [Page 5: Metrics Analysis Dashboard]
│   └── /objects/:resourceUuid     [Page 6: Detail Object Page]
│
└── /settings                      [Page 7: System & VCF Configuration Page]
```

---

# 2. Global Shell & Navigation Header

Every page (except `/login`) is enclosed within the **Global Application Shell**.

```
+-----------------------------------------------------------------------------------------+
| [Logo] Federated VCF Ops | Home  Alerts  Metrics  Settings | [Instances (All)] [Time: 24h] |
+-----------------------------------------------------------------------------------------+
| [System Ingestion Health Status Banner: All 5 VCF Instances Connected (Last Poll: 10s)]  |
+-----------------------------------------------------------------------------------------+
| PAGE CONTENT AREA                                                                       |
| ...                                                                                     |
+-----------------------------------------------------------------------------------------+
```

### Global Header Controls
1. **Global Navigation Links**: Instant route switching (`/`, `/alerts`, `/metrics`, `/settings`).
2. **Global Target Instance Selector**: Multi-select dropdown filtering all page data by VCF instance.
3. **Global Time Range Picker**: Select preset windows (`Last 1 Hour`, `6 Hours`, `24 Hours`, `7 Days`, `30 Days`, `Custom Range`).
4. **Real-time Health Indicator**: Live badge showing polling loop health and last collection timestamp.

---

# 3. Individual Page Specifications

## Page 1: User Login Page

* **Route**: `/login`
* **Target Audience**: All users accessing the portal.
* **Primary Goal**: Securely authenticate users and load personal layout preferences.

```
+--------------------------------------------------------+
|                                                        |
|                   [ Application Logo ]                 |
|             Federated VCF Operations Portal            |
|                                                        |
|        Username: [_____________________________]       |
|        Password: [_____________________________]       |
|                                                        |
|                    [  Sign In  ]                       |
|                                                        |
|  [!] Invalid credentials or session expired.           |
|                                                        |
+--------------------------------------------------------+
```

### Key Functions & Controls
* **Credentials Form**: Input fields for Username and Password.
* **Sign In Action Button**: Submits credentials to `POST /api/v1/auth/login`.
* **Session Persistence**: Stores secure HTTP-only session cookie / JWT token on success.
* **Automatic Redirect**: Redirects authenticated users directly to `/` (Personalized Home Page).

---

## Page 2: Personalized Home Page

* **Route**: `/`
* **Target Audience**: Infrastructure Operators and Cloud Administrators.
* **Primary Goal**: Provide a customized, high-level executive overview of monitored VCF instances, pinned objects, and active alerts.

```
+-----------------------------------------------------------------------------------------+
| [Customize Dashboard]                                           [Save Layout Preference]|
+------------------------------------+----------------------------------------------------+
| WIDGET 1: Active Alerts Summary    | WIDGET 2: Pinned Infrastructure Objects            |
| - Critical: 3  | Warning: 14       | - Cluster-01 (vSAN): CPU 78%, Mem 82%             |
| - Top Alert: Host ESX-02 Down      | - VM-007 (SQL-Prod): CPU 94%, Latency 25ms         |
+------------------------------------+----------------------------------------------------+
| WIDGET 3: VCF Ingestion Status     | WIDGET 4: Quick Metrics Launcher                   |
| - VCF-Ops-01: Healthy (12,400 m/m)| - Host CPU Utilization Comparison                  |
| - VCF-Ops-02: Healthy (8,900 m/m)  | - Datastore Capacity Exhaustion Trends             |
+------------------------------------+----------------------------------------------------+
```

### Key Functions & Controls
* **Customization Mode Toggle**: Allows users to drag, resize, add, or remove dashboard widgets.
* **Save Preferences Button**: Persists the user's custom layout to backend database (`PUT /api/v1/users/preferences`).
* **Active Alerts Summary Widget**: Interactive counts grouped by severity; clicking a count filters and redirects to `/alerts`.
* **Pinned Objects Widget**: Displays quick status metrics for user-favorite VMs, Hosts, or Clusters.
* **Click-Through Navigation**: Clicking any object or alert card immediately opens its detail page.

---

## Page 3: Alerts Analysis Page

* **Route**: `/alerts`
* **Target Audience**: System Administrators and Incident Response Teams.
* **Primary Goal**: Provide rich, multi-dimensional slicing and dicing of alerts across all connected VCF instances.

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

### Key Functions & Controls
* **Faceted Filter Toolbar**: Multi-select dropdowns for VCF Instance, Alert Severity (`CRITICAL`, `IMMEDIATE`, `WARNING`, `INFO`), Alert Status (`ACTIVE`, `CANCELED`), and Resource Kind.
* **Instant Text Search Bar**: Real-time client-side search filtering table rows by alert name or resource name.
* **Interactive Timeline Chart**: Stacked bar chart rendering alert counts over time. Dragging a time box zooms into that time window across the table.
* **Interactive Severity Donut**: Clicking a donut segment (e.g., `CRITICAL`) instantly filters the table below.
* **Alert Table Actions**: Sortable columns, virtualized infinite scrolling, CSV export button.
* **Row Click Action**: Opens Page 4 (`/alerts/:alertId`).

---

## Page 4: Detail Alert Page

* **Route**: `/alerts/:alertId`
* **Target Audience**: Engineers troubleshooting a specific alert.
* **Primary Goal**: Show detailed triggering conditions, impact scope, associated metrics, and provide a deep-link to the native VCF Operations console.

```
+-----------------------------------------------------------------------------------------+
| <- Back to Alerts Analysis                                                              |
| ALERT DETAILS: High CPU Ready Latency on Virtual Machine VM-007                         |
+----------------------------------------------------+------------------------------------+
| ALERT PROPERTIES                                   | IMPACTED RESOURCE CONTEXT          |
| - Alert ID: alt-98234-vcf                          | - Resource Name: VM-007            |
| - Severity: WARNING                                | - Resource Kind: VirtualMachine    |
| - Status: ACTIVE                                   | - Host System: esx-04.corp.local   |
| - Trigger Time: 2026-10-03 10:18:00 UTC            | - VCF Instance: VCF-Ops-01         |
+----------------------------------------------------+------------------------------------+
| TRIGGERING METRIC CHART OVERLAY                                                         |
| [ cpu|ready_summation (ms) timeline chart showing spike at 10:18 UTC ]                   |
+-----------------------------------------------------------------------------------------+
| ACTION TOOLBAR:                                                                         |
| [ Open Alert in VCF Operations Console -> ]  (Opens native VCF 9 web UI in a new tab)   |
+-----------------------------------------------------------------------------------------+
```

### Key Functions & Controls
* **Alert Overview Panel**: Displays alert definition, triggering thresholds, impact score, and status.
* **Triggering Metric Timeline**: Embedded chart rendering the exact metric key that triggered the alert.
* **External Launch Button (`Open in VCF Operations`)**:
  * Constructs a deep-link URL to the source VCF Operations 9 environment.
  * Opens `https://{vcf-hostname}/ui/index.action#...` in a new browser tab.

---

## Page 5: Metrics Analysis Dashboard

* **Route**: `/metrics`
* **Target Audience**: Performance Engineers and Capacity Planners.
* **Primary Goal**: Dynamic timeseries exploration, dynamic multi-metric overlays, percentile slicing, and resolution toggling.

```
+----------------------------------+------------------------------------------------------+
| RESOURCE TREE EXPLORER           | METRIC CHARTING CANVAS                               |
| Search: [ VM-007            ]    | Granularity: [ (1-Min Raw) | (5-Min) | (1-Hour) ]    |
| - [x] Virtual Machine: VM-007    +------------------------------------------------------+
| - [ ] Virtual Machine: VM-008    | CHART 1: CPU Usage (%) & CPU Ready Time (ms)         |
| - [ ] Host: esx-01.corp.local    | [~~~~~~~~ Multi-Line Timeseries Chart ~~~~~~~~~~~~~] |
|                                  +------------------------------------------------------+
| METRIC SELECTION GRID            | CHART 2: Memory Consumed (KB) vs Swap Used           |
| [x] cpu|usage_average            | [~~~~~~~~ Multi-Line Timeseries Chart ~~~~~~~~~~~~~] |
| [x] cpu|ready_summation          +------------------------------------------------------+
| [x] mem|usage_average            | SUMMARY STAT CARDS                                   |
| [ ] virtualDisk|totalLatency     | - Min: 12.4% | Max: 98.2% | Avg: 45.1% | P95: 88.4%|
+----------------------------------+------------------------------------------------------+
```

### Key Functions & Controls
* **Searchable Resource Tree**: Collapsible tree view listing VCF instances, clusters, hosts, and VMs.
* **Metric Checkbox Selection**: Select multiple metrics to overlay on the chart canvas.
* **Granularity Resolution Toggle**: Switch between `Raw 1-Minute`, `5-Minute Summary Rollups`, and `1-Hour Summary Rollups`.
* **Synchronized Brush Zooming**: Click and drag a rectangular zoom box on any chart to synchronously zoom all active charts on the page.
* **Hover Tooltips**: Hover over data points to display cross-metric exact values and timestamps.
* **Summary Statistic Cards**: Displays calculated `Minimum`, `Maximum`, `Average`, and `95th Percentile (P95)` for the selected time window.
* **Save Dashboard View**: Persists custom metric combinations for quick retrieval.

---

## Page 6: Detail Object Page

* **Route**: `/objects/:resourceUuid`
* **Target Audience**: System Engineers reviewing an infrastructure asset.
* **Primary Goal**: Deep-dive analysis into a single resource (VM, Host, Cluster, or Datastore), showing performance metrics, active alerts, and component links.

```
+-----------------------------------------------------------------------------------------+
| <- Back to Metrics Analysis                                                             |
| OBJECT DETAIL: VirtualMachine - VM-007 (SQL-Database-Prod)                              |
+----------------------------------------------------+------------------------------------+
| OBJECT SUMMARY                                     | PARENT HIERARCHY                   |
| - VCF Instance: VCF-Ops-01                         | - vCenter: vc-01.corp.local        |
| - Adapter Type: VMWARE                             | - Cluster: Cluster-vSAN-01         |
| - IP Address: 10.20.30.45                          | - ESXi Host: esx-04.corp.local     |
| - Guest OS: RHEL 9 (64-bit)                        | - Datastore: vsanDatastore         |
+----------------------------------------------------+------------------------------------+
| ACTIVE ALERTS ON THIS OBJECT (2 Active)                                                 |
| - [WARNING] High CPU Ready Latency (Triggered 15 mins ago)                              |
| - [INFO] Snapshot age exceeds 7 days                                                    |
+-----------------------------------------------------------------------------------------+
| KEY PERFORMANCE METRIC CHARTS                                                           |
| [ CPU Utilization % ]   [ Memory Consumed ]   [ Disk Latency ]   [ Network Throughput ] |
+-----------------------------------------------------------------------------------------+
| ACTION TOOLBAR:                                                                         |
| [ Open Object in VCF Operations Console -> ]  (Opens object in source VCF console)       |
+-----------------------------------------------------------------------------------------+
```

### Key Functions & Controls
* **Hierarchy Breadcrumbs**: Shows parent cluster, ESXi host, and datastore relationships.
* **Object Alert List**: Inline list of active alerts bound to this specific resource UUID.
* **Standard Key Performance Grid**: Preset CPU, Memory, Disk Latency, and Network charts.
* **External Launch Button (`Open Object in VCF Operations`)**: Opens the exact object dashboard in the source VCF Operations 9 web console in a new browser tab.

---

## Page 7: System & VCF Instance Configuration Page

* **Route**: `/settings`
* **Target Audience**: System Administrators.
* **Primary Goal**: Manage VCF Operations 9 instance connections, configure authentication methods, adjust polling intervals, and manage data retention rules.

```
+-----------------------------------------------------------------------------------------+
| VCF OPERATIONS INSTANCES MANAGEMENT                      [ + Add VCF Instance ]         |
+-----------------------------------------------------------------------------------------+
| Instance Name | Hostname / IP      | Auth Type    | Polling Interval | Status           |
|---------------+--------------------+--------------+------------------+------------------|
| VCF-Ops-01    | vcf-ops-01.corp    | OpsToken     | 60 seconds       | [Healthy] [Edit] |
| VCF-Ops-02    | vcf-ops-02.corp    | Bearer (VIDB)| 60 seconds       | [Healthy] [Edit] |
+-----------------------------------------------------------------------------------------+
| MODAL: ADD / EDIT VCF INSTANCE CONNECTION                                               |
| Instance Name: [ VCF-Ops-03                          ]                                  |
| Hostname / IP: [ vcf-ops-03.corp.local               ]                                  |
|                                                                                         |
| AUTHENTICATION METHOD:                                                                  |
| ( ) Option A: Local Credentials (OpsToken) - VCF 9.0 & Local                            |
|     Username:    [ admin                        ]                                       |
|     Password:    [ ********************         ]                                       |
|     Auth Source: [ LOCAL                        ]                                       |
|                                                                                         |
| (o) Option B: VCF SSO / VIDB API Token (Bearer Token) - VCF 9.1+ Best Practice          |
|     VIDB Host:          [ vidb.corp.local       ]                                       |
|     Client Name / ID:   [ federated-ops-client  ]                                       |
|     API Refresh Token:  [ ********************  ]                                       |
|                                                                                         |
| [ Test Connection ]                                               [ Save Instance ]    |
+-----------------------------------------------------------------------------------------+
| RETENTION & SYSTEM SETTINGS                                                             |
| - Raw 1-Min Metrics Retention: [ 48 ] Hours                                             |
| - Summary Rollups Retention:   [ 90 ] Days                                              |
| - Auto-Prune Daily Execution:  [ 00:00 ] UTC                                            |
|                                                                    [ Save System Settings]|
+-----------------------------------------------------------------------------------------+
```

### Key Functions & Controls
* **Instance Management Table**: Lists all connected VCF Operations instances with real-time status badges.
* **Dual Authentication Configuration Modal**:
  * **Option A (Local OpsToken)**: Input fields for Username, Password, and Auth Source.
  * **Option B (VCF SSO Bearer Token)**: Input fields for VIDB Host, Client ID, and API Refresh Token.
* **Test Connection Button**: Triggers `POST /api/v1/instances/test` to validate credentials and connectivity before saving.
* **Retention Policy Form**: Adjust raw 1-minute metric retention (hours) and summary rollup retention (days).

---

# 4. Documentation Best Practices for Web Pages & HTML Interfaces

When specifying web application pages, UI developers and technical architects follow these core best practices:

1. **Clear Layout Structure & Sitemap**: Every page must have a well-defined URL route, target audience, and explicit navigation path.
2. **Standardized Page Specification Template**: Specifying each page using a consistent structure (Identifiers, Wireframe Layout, Key Controls, Data Endpoints, and User Actions) ensures complete developer alignment before coding begins.
3. **Faceted Filter & State Rules**: Document how user inputs (e.g., selecting a dropdown or dragging a timeline) alter the URL query string and trigger backend API calls.
4. **Error & Empty State Definitions**: Explicitly specify how pages behave when data is missing, when network timeouts occur, or when loading states are active (e.g. skeleton loaders vs error banners).
5. **Design System Consistency**:
   * **Color Palette**: Standardized severity colors (`CRITICAL` = `#ef4444`, `IMMEDIATE` = `#f97316`, `WARNING` = `#f59e0b`, `INFO` = `#3b82f6`).
   * **Typography & Spacing**: Responsive layouts with virtualized scrolling for large data tables to guarantee sub-200ms rendering speed.
