# Page 5: Metrics Analysis Dashboard

* **Route**: `/metrics`
* **Target Audience**: Performance Engineers and Capacity Planners.
* **Primary Goal**: Dynamic timeseries exploration, multi-metric overlays, statistical percentiles (`P95`/`P99`), and resolution toggling.

---

## 📐 Visual Layout & Wireframe

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

---

## ⚡ Key Functions & Controls

1. **Searchable Resource Tree**: Collapsible tree view listing VCF instances, clusters, hosts, and VMs.
2. **Metric Checkbox Selection**: Select multiple metric keys to overlay on chart canvas.
3. **Granularity Resolution Toggle**: Switch between `1-Minute Raw Buffer`, `5-Minute Summary Rollups`, and `1-Hour Summary Rollups`.
4. **Synchronized Brush Zooming**: Drag a rectangular box on any chart to synchronously zoom all active charts on the page.
5. **Hover Tooltips**: Hover over data points to display cross-metric exact values and timestamps.
6. **Summary Statistic Cards**: Displays calculated `Minimum`, `Maximum`, `Average`, and `95th Percentile (P95)` for selected time window.
7. **Save Dashboard View**: Persists custom metric combinations for quick retrieval.

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/objects/tree`: Retrieves hierarchical object tree grouped by VCF instance.
* `GET /api/v1/metrics/query`: Fetches metric timeseries data points (`resource_uuids`, `stat_keys`, `resolution`, `begin`, `end`).
