# Page 7: System & VCF Configuration Page

* **Route**: `/settings`
* **Target Audience**: System Administrators.
* **Primary Goal**: Manage VCF Operations 9 instance connections, configure authentication credentials (Local `OpsToken` vs. VCF SSO `Bearer Token`), manage metric and alert collection configurations (`metrics_list.yaml` & `alerts_list.yaml`) dynamically, and configure data retention rules.

---

## 📐 Graphical Visual Layout & Wireframe

```mermaid
graph TD
    subgraph Settings_Workspace ["System & VCF Configuration Workspace"]
        direction TB

        subgraph Ingestion_Banner ["Live Ingestion System Health Banner"]
            B1["🟢 Status: Ingestion Engine Online (Connected to 5 VCF instances, 1-min poll completed 8s ago)"]
        end

        subgraph Instance_Section ["VCF Operations Instances Management Panel"]
            I_Header["🌐 Registered Instances Table Header | Action: + Add VCF Instance"]
            I_Table["📋 Instance Grid Columns: Instance Name | Hostname / IP | Auth Type | Polling Interval | Status Badge | Actions (Edit / Delete)"]
        end

        subgraph Telemetry_Section ["Telemetry Collection Rules Editor Panel"]
            T_Tabs["Tab Switcher: 📊 Metrics Collection (metrics_list.yaml) | 🚨 Alert Collection (alerts_list.yaml)"]
            T_Kind["Object Type Tabs: VirtualMachine | HostSystem | ClusterComputeResource | Datastore"]
            T_Editor["Structured Grid & Raw YAML Editor: Key | Name | Unit | Active Toggle | Add Metric / Rule"]
            T_Action["💾 Action: Save & Apply Dynamic Telemetry Rules"]
        end

        subgraph Auth_Modal ["Add / Edit Instance Modal Dialog"]
            direction TB
            M_Inputs["📝 Connection Details: Instance Name & Hostname / IP"]
            
            subgraph Auth_Options ["Dual Authentication Selector"]
                direction LR
                Opt_A["🔑 Option A: Local OpsToken<br/>• Username<br/>• Password<br/>• Auth Source"]
                Opt_B["🛡️ Option B: VCF SSO / VIDB Bearer Token<br/>• VIDB Host<br/>• Client Name / ID<br/>• API Refresh Token"]
            end

            M_Actions["🧪 Actions: [ Test Connection ] | 💾 [ Save Instance ]"]
        end

        subgraph Retention_Section ["Data Retention & System Settings Panel"]
            R1["⏱️ Raw 1-Min Metrics Retention: Input (48 Hours default)"]
            R2["📊 Summary Rollups Retention: Input (90 Days default)"]
            R3["🧹 Auto-Prune Execution Schedule: Input (00:00 UTC default)"]
            R4["💾 Action: Save System Settings Button"]
        end
    end

    Ingestion_Banner --> Instance_Section
    Instance_Section --> Telemetry_Section
    Telemetry_Section --> Auth_Modal
    Auth_Modal --> Retention_Section
```

### Component & Region Layout Breakdown

| Section | Component | Features & User Interactions |
| :--- | :--- | :--- |
| **Ingestion System Health Banner** | Top Status Banner | Real-time status banner displaying ingestion engine health, total connected instances, and last 1-minute polling timestamp. |
| **Instance Management Table** | Top Panel | Interactive table displaying registered VCF Operations instances, status badges (`Healthy`, `Unreachable`, `Auth Error`), and edit/delete triggers. |
| **Telemetry Collection Rules Editor** | Middle Panel | Interactive editor for `metrics_list.yaml` and `alerts_list.yaml`. Uses dynamic YAML parsing (`parseYamlConfig`) to render structured metric keys and alert filters per object kind tab (`VirtualMachine`, `HostSystem`, `ClusterComputeResource`, `Datastore`). Supports active toggles, key additions, and raw YAML editing with dynamic reload without application restart. |
| **Dual Auth Modal** | Modal Dialog | Supports **Option A** (Local `OpsToken` credentials) and **Option B** (VCF SSO `Bearer Token` via Identity Broker). Includes a "Test Connection" button that validates endpoints prior to saving. |
| **Retention Policy Form** | Bottom Panel | Configures raw metric buffer purge thresholds (hours) and long-term rollup retention windows (days). |

---

## ⚡ Key Functions & Controls

1. **Instance Management Table**: Lists all registered VCF Operations instances with real-time health badges (`Healthy`, `Unreachable`, `Auth Error`).
2. **Telemetry Collection Configuration Editor**:
   * **Metrics Rules (`metrics_list.yaml`)**: Edit collected metric stat keys, display names, units, descriptions, and active flags per object kind (`VirtualMachine`, `HostSystem`, `ClusterComputeResource`, `Datastore`).
   * **Alert Rules (`alerts_list.yaml`)**: Edit monitored alert sub-types, names, and minimum severities per object kind.
   * **Interactive Form & YAML Code View**: Toggle between structured form grid and direct YAML text editing with syntax validation.
   * **Dynamic Apply Button (`Save & Apply Dynamic Telemetry Rules`)**: Persists YAML file updates to disk and notifies the background ingestion engine to immediately update polling criteria without restarting the application.
3. **Dual Authentication Configuration Modal**:
   * **Option A (Local OpsToken)**: Input fields for Username, Password, and Auth Source.
   * **Option B (VCF SSO Bearer Token)**: Input fields for VIDB Host, Client ID, and API Refresh Token.
4. **Test Connection Action Button**: Calls `POST /api/v1/instances/test` to validate credentials and REST API reachability before saving.
5. **Retention Policy Form**: Configures retention duration for raw 1-minute metrics (hours) and summary rollup metrics (days).

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/instances`: Retrieves list of registered VCF Operations instances.
* `POST /api/v1/instances`: Registers a new VCF Operations instance.
* `POST /api/v1/instances/test`: Tests connection and credentials for candidate instance.
* `GET /api/v1/system/config/metrics`: Retrieves current `metrics_list.yaml` content and parsed JSON structure.
* `PUT /api/v1/system/config/metrics`: Saves updated `metrics_list.yaml` to disk and reloads ingestion rules dynamically.
* `GET /api/v1/system/config/alerts`: Retrieves current `alerts_list.yaml` content and parsed JSON structure.
* `PUT /api/v1/system/config/alerts`: Saves updated `alerts_list.yaml` to disk and reloads ingestion rules dynamically.
* `PUT /api/v1/system/settings`: Updates global system settings and data retention policies.
