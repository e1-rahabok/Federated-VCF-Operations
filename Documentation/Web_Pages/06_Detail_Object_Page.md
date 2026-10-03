# Page 6: Detail Object Page

* **Route**: `/objects/:resourceUuid`
* **Target Audience**: System Engineers reviewing a single infrastructure asset.
* **Primary Goal**: Deep-dive performance and status analysis for a specific resource (VM, ESXi Host, Cluster, Datastore), showing KPI charts, active alerts, and parent-child hierarchy.

---

## 📐 Visual Layout & Wireframe

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

---

## ⚡ Key Functions & Controls

1. **Hierarchy Breadcrumbs**: Displays parent vCenter, Cluster, ESXi host, and Datastore links.
2. **Object Alert List**: Inline table displaying active alerts bound to this specific resource UUID.
3. **Standard KPI Performance Grid**: Preset charts for CPU Utilization, Memory Consumed, Disk Latency, and Network Throughput.
4. **External Launch Button (`Open Object in VCF Operations`)**: Opens the exact object dashboard in native VCF Operations 9 web console in a new tab.

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/objects/:resourceUuid`: Retrieves object properties, metadata, and parent hierarchy links.
* `GET /api/v1/alerts?resource_uuid=:resourceUuid`: Retrieves active alerts bound to this object.
* `GET /api/v1/metrics/kpi?resource_uuid=:resourceUuid`: Fetches standard KPI metric series.
