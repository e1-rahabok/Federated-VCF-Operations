# Page 2: Personalized Home Page

* **Route**: `/`
* **Target Audience**: Infrastructure Operators and Cloud Administrators.
* **Primary Goal**: Provide a customizable, executive-level overview of monitored VCF instances, pinned infrastructure objects, and active alerts summary.

---

## 📐 Visual Layout & Wireframe

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
