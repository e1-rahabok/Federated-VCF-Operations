# Architecture Overview

This document provides a high-level architectural reference for the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

For full details, refer to the primary [SOLUTION.md](../SOLUTION.md) specification document.

---

## 1. High-Level Data Flow

1. **Ingestion Service**: Executes every 60 seconds across all registered VCF 9 instances.
2. **Delta Querying**: Reads `last_polled_timestamp` from `ingestion_watermarks` table and requests metrics/alerts updated since that timestamp.
3. **Deduplication**: Enforces database composite indexes (`instance_id + resource_uuid + stat_key + timestamp`) to drop duplicates.
4. **Summary Aggregation**: Asynchronously aggregates 1-minute raw metrics into 5-minute and 1-hour rollups (`min`, `max`, `avg`, `p95`, `sample_count`).
5. **Interactive UI**: Serves React-based dashboards for Alert Triage and Metric Analysis with dynamic filtering and deep-links to component VCF Operations instances.

---

## 2. Key Components

* **Ingestion Worker**: Handles session token management (`POST /api/auth/token/acquire`) and async parallel HTTP requests to `/suite-api/api/resources/stats/query` and `/suite-api/api/alerts`.
* **Database Layer**: SQLite (with Write-Ahead Logging / WAL mode enabled) or PostgreSQL.
* **Web UI**: Built with React 18, Tailwind CSS, TanStack Table, and Apache ECharts.
