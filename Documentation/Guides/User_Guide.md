# User Guide

Welcome to the Federated VMware Cloud Foundation (VCF) Operations 9 Portal. This guide explains how to navigate the portal, personalize your dashboard, analyze active alerts, explore metric timeseries, and deep-link directly into component VCF Operations instances.

---

# 1. Global Navigation & Layout Shell

The global navigation header is present on every page:

```
+-----------------------------------------------------------------------------------------+
| [Logo] Federated VCF Ops | Home  Alerts  Metrics  Settings | [Instances (All)] [Time: 24h] |
+-----------------------------------------------------------------------------------------+
| [Health Status Banner: All VCF Instances Connected (Last Poll: 10s ago)]                |
+-----------------------------------------------------------------------------------------+
```

* **Target Instance Selector**: Multi-select dropdown located on the top right. Select "All Instances" or pick specific VCF environments. All charts, tables, and alerts instantly refresh.
* **Time Range Picker**: Global window selector (`Last 1 Hour`, `6 Hours`, `24 Hours`, `7 Days`, `30 Days`, `Custom Range`).
* **Health Banner**: Displays background polling engine health and last collection timestamp.

---

# 2. Personalizing Your Home Page (`/`)

The **Home Page** is unique to each logged-in user account.

```
+-----------------------------------------------------------------------------------------+
| [Customize Dashboard]                                           [Save Layout Preference]|
+------------------------------------+----------------------------------------------------+
| WIDGET: Active Alerts Summary      | WIDGET: Pinned Infrastructure Objects              |
| - Critical: 3  | Warning: 14       | - Cluster-01 (vSAN): CPU 78%, Mem 82%             |
| - Top Alert: Host ESX-02 Down      | - VM-007 (SQL-Prod): CPU 94%, Latency 25ms         |
+------------------------------------+----------------------------------------------------+
```

### Customizing Dashboard Widgets
1. Click **"Customize Dashboard"** on the top left.
2. Drag widgets to reorder them, resize widget cards, or click `[x]` to remove a widget.
3. Click **"+ Add Widget"** to insert new summary widgets (e.g., Pinned VMs, Storage Capacity Trends, Alert Severity Distribution).
4. Click **"Save Layout Preference"**. Your custom layout is stored in your user profile and restored automatically on future logins.

---

# 3. Slicing & Dicing Alerts (`/alerts`)

The **Alerts Analysis Workspace** allows slicing and dicing alerts across all connected VCF instances:

```
+-----------------------------------------------------------------------------------------+
| FILTERS: [VCF Instance: All v] [Severity: Critical, Warning v] [Kind: VM, Host v] [Search]|
+-----------------------------------------------------+-----------------------------------+
| CHART 1: Alert Volume Timeline (Stacked Bar)        | CHART 2: Severity Breakdown (Donut|
+-----------------------------------------------------+-----------------------------------+
| ALERTS DATA GRID (TanStack Table)                                                       |
+-----------------------------------------------------------------------------------------+
```

### Interactive Slicing Controls
* **Timeline Chart Slicing**: Drag a rectangular box over any time interval on the timeline chart. The alerts table below automatically filters to show alerts triggered within that time window.
* **Severity Donut Slicing**: Click a segment in the donut chart (e.g. `CRITICAL`). The table filters instantly to critical alerts.
* **Resource Search**: Type an object name (e.g. `VM-007`) in the search box to filter matching alerts in real time.
* **Drill-Down**: Click any alert row to open the **Detail Alert Page (`/alerts/:alertId`)**.

---

# 4. Exploring Performance Metrics (`/metrics`)

The **Metrics Analysis Dashboard** provides interactive timeseries comparison:

```
+----------------------------------+------------------------------------------------------+
| RESOURCE TREE EXPLORER           | METRIC CHARTING CANVAS                               |
| Search: [ VM-007            ]    | Granularity: [ (1-Min Raw) | (5-Min) | (1-Hour) ]    |
| - [x] Virtual Machine: VM-007    +------------------------------------------------------+
| - [ ] Virtual Machine: VM-008    | CHART 1: CPU Usage (%) & CPU Ready Time (ms)         |
| - [ ] Host: esx-01.corp.local    | [~~~~~~~~ Multi-Line Timeseries Chart ~~~~~~~~~~~~~] |
+----------------------------------+------------------------------------------------------+
```

### Interactive Chart Features
* **Resource Selector**: Use the left sidebar tree to search and check Virtual Machines, ESXi Hosts, or Clusters.
* **Metric Selector**: Check the metrics you wish to overlay (e.g., `cpu|usage_average` and `mem|usage_average`).
* **Resolution Switching**: Toggle between `Raw 1-Minute`, `5-Minute Rollups`, and `1-Hour Rollups`.
* **Synchronized Drag-to-Zoom**: Click and drag a zoom box on any chart. All charts on the page zoom synchronously.
* **Hover Crosshair Tooltip**: Move your mouse over any line to inspect exact values across all selected metrics at that timestamp.

---

# 5. Deep-Linking to Component VCF Operations Console

When reviewing a specific Alert or Infrastructure Object on its detail page:

```
+-----------------------------------------------------------------------------------------+
| ACTION TOOLBAR:                                                                         |
| [ Open in VCF Operations Console -> ]  (Opens native VCF 9 web UI in a new tab)         |
+-----------------------------------------------------------------------------------------+
```

1. Click the **"Open in VCF Operations Console"** action button.
2. The application constructs the deep-link URL to the source VCF Operations 9 instance.
3. The exact object or alert opens in a new browser tab in the native VCF Operations console.
