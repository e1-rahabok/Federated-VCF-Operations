# System Limitations & Feature Roadmap

This document outlines current architectural constraints, scale limits, and planned future feature enhancements for the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

# 1. Current System Limitations

## 1.1 Multi-Instance Scale Limits
* **Maximum Tested Instances**: Tested and verified up to **20 concurrent VCF Operations 9 instances**. Scaling beyond 30 instances on a single SQLite container may require migrating to a clustered PostgreSQL backend.
* **Maximum Objects Tracked**: Up to **50,000 infrastructure objects** (VMs, ESXi hosts, clusters, datastores) across instances.
* **Maximum Data Ingestion Rate**: Up to **500,000 metric data points per 1-minute cycle**.

## 1.2 Data Retention & Historical Scope
* **Raw 1-Minute Metrics Buffer**: High-resolution 1-minute raw metrics are retained for a maximum window of **48 hours by default** (configurable up to 7 days).
* **Summary Metric Rollups**: 5-minute and 1-hour rollups (`min`, `max`, `avg`, `p95`, `sample_count`) are retained for **90 days by default**.
* **No Pre-Onboarding Historical Backfill**: When a new VCF Operations instance is registered, collection begins from the moment of onboarding (`begin = NOW() - 2 minutes`). Historical metrics recorded prior to app deployment are not imported.

## 1.3 Collection Scope Constraints
* **YAML-Defined Metric Scope**: Only metrics listed in `Configuration/metrics_list.yaml` are collected. Custom super-metrics or unlisted metrics are ignored during the 1-minute delta query.
* **Instanced Metrics Disabled by Default**: Per-core CPU or per-disk metrics (`collect_instanced_metrics: false`) are disabled by default to prevent database bloat.

---

# 2. Future Architectural Roadmap

```
  Phase 1 (Current v1.0)           Phase 2 (v1.5 Planned)          Phase 3 (v2.0 Future)
  ----------------------           ----------------------          ----------------------
  - 1-Min Delta Ingestion          - Webhook Alert Dispatch        - AI Anomaly Detection
  - SQLite WAL / PostgreSQL        - Multi-Tenancy RBAC            - Custom Super Metrics
  - Personalized Home Page         - Email / Slack Notifications   - Auto-Remediation Hooks
  - Deep-link VCF Consoles         - PDF Report Export             - Multi-Region Clustering
```

### Phase 2 Planned Features (v1.5)
1. **Real-time Alert Notifications**: Slack, Teams, and PagerDuty webhook dispatch when `CRITICAL` alerts trigger.
2. **Scheduled PDF Reports**: Automated weekly executive summary PDF reports emailed to administrators.
3. **Multi-Tenancy Workspace Isolation**: Tenant-specific view filters allowing team leads to only see resources assigned to their department.
4. **Instanced Metric Toggle UI**: Web UI controls to enable per-disk or per-interface metrics on specific critical VMs.

### Phase 3 Future Vision (v2.0)
1. **AI Anomaly Detection**: Machine learning workload baselining across federated VCF environments.
2. **Automated Remediation Triggering**: Execute VCF Operations Orchestrator workflows directly from the Detail Alert Page.
