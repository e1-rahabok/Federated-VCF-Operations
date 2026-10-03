# Page 4: Detail Alert Page

* **Route**: `/alerts/:alertId`
* **Target Audience**: Engineers troubleshooting a specific alert.
* **Primary Goal**: Display triggering conditions, impact scope, associated metrics, and provide direct deep-linking into the native source VCF Operations web console.

---

## 📐 Visual Layout & Wireframe

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

---

## ⚡ Key Functions & Controls

1. **Alert Overview Panel**: Displays alert definition, triggering thresholds, impact score, and current status.
2. **Impacted Resource Context**: Shows resource metadata, host system, and source VCF instance.
3. **Triggering Metric Timeline Chart**: Embedded chart rendering the exact metric key that triggered the alert.
4. **External Launch Button (`Open in VCF Operations`)**:
   * Constructs deep-link URL to source VCF Operations 9 environment.
   * Executes `window.open("https://{vcf-hostname}/ui/index.action#...", "_blank", "noopener,noreferrer")`.

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/alerts/:alertId`: Fetches full alert object payload.
* `GET /api/v1/metrics/timeseries`: Queries metrics database for triggering resource UUID and stat key around trigger timestamp window.
