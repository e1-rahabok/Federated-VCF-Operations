# Page 6: Detail Object Page

* **Route**: `/objects/:resourceUuid`
* **Target Audience**: System Engineers reviewing a single infrastructure asset.
* **Primary Goal**: Deep-dive performance and status analysis for a specific resource (VM, ESXi Host, Cluster, Datastore), showing KPI charts, active alerts, and parent-child hierarchy.

---

## 📐 Graphical Visual Layout & Wireframe

```mermaid
graph TD
    subgraph Detail_Object_Workspace ["Detail Object Page Layout"]
        direction TB

        subgraph Object_Header ["Page Navigation Header"]
            OH1["⬅️ Back to Metrics Analysis Link"]
            OH2["💻 OBJECT DETAIL: VirtualMachine - VM-007 (SQL-Database-Prod)"]
        end

        subgraph Summary_Row ["Object Summary & Infrastructure Hierarchy Grid"]
            direction LR

            subgraph Summary_Box ["Object Properties Summary"]
                S1["🌐 VCF Instance: VCF-Ops-01"]
                S2["⚙️ Adapter Type: VMWARE"]
                S3["🌐 IP Address: 10.20.30.45"]
                S4["🐧 Guest OS: RHEL 9 (64-bit)"]
            end

            subgraph Hierarchy_Box ["Parent Hierarchy Breadcrumbs"]
                H1["🏢 vCenter: vc-01.corp.local"]
                H2["📦 Cluster: Cluster-vSAN-01"]
                H3["🖥️ ESXi Host: esx-04.corp.local"]
                H4["💾 Datastore: vsanDatastore"]
            end
        end

        subgraph Active_Alerts_Section ["Active Alerts on Resource Panel"]
            A1["⚠️ WARNING: High CPU Ready Latency (Triggered 15 mins ago)"]
            A2["ℹ️ INFO: Snapshot age exceeds 7 days"]
        end

        subgraph KPI_Grid ["Standard KPI Performance Chart Grid (2x2)"]
            direction LR

            subgraph KPI_Row1 ["Compute Performance"]
                K1["📈 CPU Utilization %"]
                K2["📈 Memory Consumed (KB)"]
            end

            subgraph KPI_Row2 ["Storage & Network"]
                K3["📈 Virtual Disk Latency (ms)"]
                K4["📈 Network Throughput (KB/s)"]
            end
        end

        subgraph External_Action ["Console Deep Link Toolbar"]
            E1["🚀 Open Object in VCF Operations Console Button (Opens source VCF UI in new tab)"]
        end
    end

    Object_Header --> Summary_Row
    Summary_Row --> Active_Alerts_Section
    Active_Alerts_Section --> KPI_Grid
    KPI_Grid --> External_Action
```

### Component & Region Layout Breakdown

| Section | Grid Position | Features & User Interactions |
| :--- | :--- | :--- |
| **Object Header** | Top Navigation Bar | Route breadcrumb and resource title banner. |
| **Summary & Hierarchy** | Top 2-Column Grid | Metadata properties (IP, OS, Adapter) and clickable parent infrastructure links. |
| **Active Alerts List** | Middle Panel | Live list of triggered alerts for this UUID with severity badges and direct alert links. |
| **KPI Chart Grid** | 2x2 Chart Panel | Standardized KPI timeseries charts (CPU, Memory, Disk Latency, Network) with synchronized tooltips. |
| **Action Toolbar** | Bottom Bar | Direct deep-link launcher to open object in native VCF Operations console (`window.open`). |

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
