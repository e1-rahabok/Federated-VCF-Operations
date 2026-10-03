# Configuration Guide

This guide describes how to configure VCF Operations 9 instance connections and customize metric/alert collection rules.

---

# 1. Connecting VCF Operations 9 Instances (In-Context Web UI)

All target environment setup is managed directly inside the web application at **Settings (`/settings`)**.

```
+-----------------------------------------------------------------------------------------+
| MODAL: ADD VCF OPERATIONS INSTANCE                                                      |
+-----------------------------------------------------------------------------------------+
| Instance Display Name: [ VCF-Ops-Cluster-01            ]                                |
| Hostname or IP:       [ vcf-ops-01.corp.local          ]                                |
|                                                                                         |
| AUTHENTICATION METHOD:                                                                  |
|                                                                                         |
| ( ) Option A: Local Credentials (OpsToken) — Best for VCF 9.0 & Local Accounts           |
|     Username:    [ admin                         ]                                      |
|     Password:    [ ********************          ]                                      |
|     Auth Source: [ LOCAL                         ]                                      |
|                                                                                         |
| (o) Option B: VCF SSO / VIDB API Token (Bearer Token) — Best Practice for VCF 9.1+      |
|     VIDB Host:          [ vidb.corp.local        ]                                      |
|     Client Name / ID:   [ federated-ops-client   ]                                      |
|     API Refresh Token:  [ ********************   ]                                      |
|                                                                                         |
| [ Test Connection ]                                               [ Save Instance ]     |
+-----------------------------------------------------------------------------------------+
```

### In-Context Setup Workflow
1. Navigate to **Settings (`/settings`)** and click **"+ Add VCF Instance"**.
2. **Select Authentication Strategy**:
   * **Option A (Local `OpsToken`)**: Enter username, password, and auth source (e.g. `LOCAL` or `LDAP`).
   * **Option B (VCF SSO `Bearer Token`)**: Enter VIDB host, Client ID, and API Refresh Token generated from VCF Operations Fleet Management (`Fleet Management -> Identity & Access -> API Tokens`).
3. Click **"Test Connection"**. The web app verifies network route, TLS certificate, and token acquisition against the target instance.
4. Click **"Save Instance"**. Background polling starts automatically within 60 seconds.

---

# 2. Metric & Alert Collection Configuration (YAML Files)

The application uses external YAML files located in `Configuration/` to define which metrics and alert filters are fetched every 1 minute.

```
Configuration/
├── metrics_list.yaml    # Performance metric keys grouped by object type
└── alerts_list.yaml     # Alert subtypes and severities grouped by object type
```

## 2.1 Metrics Collection Rules (`Configuration/metrics_list.yaml`)

Metrics are organized by object type (`VirtualMachine`, `HostSystem`, `ClusterComputeResource`, `Datastore`):

```yaml
version: "1.0"

settings:
  default_polling_interval_seconds: 60
  collect_instanced_metrics: false

object_types:
  VirtualMachine:
    description: "Virtual Machine performance metrics"
    metrics:
      - key: "cpu|usage_average"
        name: "CPU Usage (%)"
        unit: "percent"
        description: "Percentage of CPU actively used by the VM"

      - key: "mem|usage_average"
        name: "Memory Usage (%)"
        unit: "percent"
        description: "Percentage of guest memory actively used"
```

### Managing Metrics
* **Enable a Metric**: Simply list the metric block under the target `object_type`.
* **Disable a Metric**: Comment out the metric block using `#`.
* **Dynamic Hot-Reloading**: The ingestion engine watches file modification timestamps. Updating `metrics_list.yaml` updates collection rules on the next 1-minute cycle without restarting the app.

---

## 2.2 Alert Collection Rules (`Configuration/alerts_list.yaml`)

Defines monitored alert subtypes and minimum severity thresholds:

```yaml
version: "1.0"

settings:
  polling_interval_seconds: 60
  include_canceled_alerts: true
  min_alert_severity: "WARNING" # Options: CRITICAL, IMMEDIATE, WARNING, INFO

object_types:
  VirtualMachine:
    alert_filters:
      - alert_sub_type: "CPU"
        name: "VM High CPU Utilization Alert"
        min_severity: "WARNING"

      - alert_sub_type: "AVAILABILITY"
        name: "VM Guest OS Down / Unresponsive Alert"
        min_severity: "CRITICAL"
```

---

# 3. System Environment Settings (`.env`)

Global system runtime controls are set in the `.env` file:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Web application HTTP listening port. |
| `DATABASE_URL` | `file:./data/vcf_ops.db` | SQLite database file location or PostgreSQL connection string. |
| `ENCRYPTION_KEY` | *(32-byte hex)* | AES-256-GCM secret key used to encrypt VCF passwords at rest. |
| `POLLING_INTERVAL_SECONDS` | `60` | Global ingestion cycle frequency in seconds. |
| `RETENTION_RAW_HOURS` | `48` | High-resolution 1-minute raw metric retention window. |
| `RETENTION_SUMMARY_DAYS` | `90` | 5-minute and 1-hour summary rollup retention window. |
