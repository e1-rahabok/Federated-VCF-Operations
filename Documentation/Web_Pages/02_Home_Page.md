# Page 2: Personalized Home Page

* **Route**: `/`
* **Target Audience**: Infrastructure Operators and Cloud Administrators.
* **Primary Goal**: Provide a customizable, executive-level overview of monitored VCF instances, pinned infrastructure objects, and active alerts summary.

---

## 📐 Graphical Visual Layout & Wireframe

```mermaid
graph TD
    subgraph Home_Dashboard ["Personalized Home Page Layout"]
        direction TB

        subgraph Toolbar ["Dashboard Control Header"]
            T1["✏️ Customize Dashboard Layout Toggle"]
            T2["💾 Save Layout Preference Button"]
        end

        subgraph Grid_Layout ["2x2 Executive Widget Grid"]
            direction LR

            subgraph Widget_Col1 ["Left Widget Column"]
                W1["🚨 Widget 1: Active Alerts Summary<br/>• Critical: 3 | Warning: 14<br/>• Top Alert: Host ESX-02 Down"]
                W3["⚡ Widget 3: VCF Ingestion Status<br/>• VCF-Ops-01: Healthy (12,400 m/min)<br/>• VCF-Ops-02: Healthy (8,900 m/min)"]
            end

            subgraph Widget_Col2 ["Right Widget Column"]
                W2["📌 Widget 2: Pinned Infrastructure Objects<br/>• Cluster-01 (vSAN): CPU 78%, Mem 82%<br/>• VM-007 (SQL-Prod): CPU 94%, Latency 25ms"]
                W4["🚀 Widget 4: Quick Metrics Launcher<br/>• Host CPU Utilization Comparison<br/>• Datastore Capacity Exhaustion Trends"]
            end
        end
    end

    Toolbar --> Grid_Layout
```

### Component & Widget Layout Breakdown

| Widget / Region | Grid Position | Features & Interactions |
| :--- | :--- | :--- |
| **Dashboard Controls** | Top Toolbar | Toggle edit mode to drag, resize, add, or delete widgets. "Save Preference" persists grid layout. |
| **Active Alerts Summary** | Grid Slot (Top-Left) | Interactive donut & severity counters. Clicking a severity count redirects to `/alerts` with pre-applied filters. |
| **Pinned Objects** | Grid Slot (Top-Right) | Displays quick status metrics for user-bookmarked VMs, Hosts, or Clusters. Opens `/objects/:uuid`. |
| **Ingestion Health Status** | Grid Slot (Bottom-Left) | Live telemetry rate (metrics/min) and polling status for each registered VCF Operations 9 instance. |
| **Quick Metrics Launcher** | Grid Slot (Bottom-Right) | One-click access to pre-configured comparative metric dashboard views. |

---

## ⚡ Key Functions & Controls

1. **Customization Mode Toggle**: Allows users to drag, resize, add, or remove dashboard widgets.
2. **Save Preferences Button**: Persists custom widget layouts to backend database (`PUT /api/v1/users/preferences`).
3. **Active Alerts Summary Widget**: Displays interactive alert counts grouped by severity; clicking a severity count redirects to `/alerts` with pre-applied filters.
4. **Pinned Objects Widget**: Displays real-time status metrics for user-bookmarked VMs, Hosts, or Clusters.
5. **Click-Through Navigation**: Clicking any object or alert card immediately opens its respective detail page (`/objects/:uuid` or `/alerts/:id`).

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/users/preferences`: Fetches saved widget layout preferences for logged-in user.
* `PUT /api/v1/users/preferences`: Saves updated widget grid placement.
* `GET /api/v1/alerts/summary`: Retrieves total counts of active alerts grouped by severity level.
* `GET /api/v1/objects/pinned`: Retrieves live status and key metrics for pinned resource UUIDs.
