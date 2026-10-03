# Configuration Guide

The application controls metric and alert collection using human-readable YAML configuration files located in the `Configuration/` folder.

---

## 1. Metrics List Configuration (`Configuration/metrics_list.yaml`)

Defines which performance metrics are fetched from VCF Operations 9 every 1 minute.

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
```

### How to Modify Metrics
* **Add a New Metric**: Add a new entry under the corresponding `object_types` block with its `key`, `name`, `unit`, and `description`.
* **Disable a Metric**: Comment out the metric block using `#`.
* **Dynamic Reload**: Changes take effect on the next 1-minute collection cycle.

---

## 2. Alerts List Configuration (`Configuration/alerts_list.yaml`)

Defines which alert types and severities are retrieved and filtered per object type.

```yaml
version: "1.0"

settings:
  polling_interval_seconds: 60
  include_canceled_alerts: true
  min_alert_severity: "WARNING"

object_types:
  VirtualMachine:
    description: "Alert definitions monitored for Virtual Machines"
    alert_filters:
      - alert_sub_type: "CPU"
        name: "VM High CPU Utilization Alert"
        min_severity: "WARNING"
```

### Severity Levels Supported
* `CRITICAL`
* `IMMEDIATE`
* `WARNING`
* `INFO`
