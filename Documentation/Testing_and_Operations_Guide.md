# QA Testing & Operations Runbook

This document defines the Quality Assurance (QA) testing strategy, test automation suite guidelines, operational runbooks, and disaster recovery procedures for the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

# 1. Quality Assurance (QA) Testing Strategy

The application enforces the **Testing Pyramid**:

```
           / \
          /   \        E2E Tests (Playwright / Cypress)
         /     \       - User Login, Dashboard Customization, Deep Links
        /-------\
       /         \     Integration Tests (Supertest + SQLite Memory)
      /           \    - API Routes, Deduplication Watermarks, Authorization
     /-------------\
    /               \  Unit Tests (Jest / Vitest)
   /                 \ - Metric Rollup Math, Encryption, Zod Schemas, Filters
  /-------------------\
```

## 1.1 Unit Testing Guidelines (`Vitest` / `Jest`)
* **Coverage Threshold**: Business logic modules (`ingestion/`, `services/`, `utils/`) MUST maintain minimum 85% line coverage.
* **Core Unit Tests**:
  * Mathematical accuracy of 5-minute and 1-hour rollup calculations (`min`, `max`, `avg`, `p95`).
  * AES-256-GCM encryption and decryption round-trips for VCF passwords.
  * Zod schema parsing for invalid or malformed query requests.
  * Watermark timestamp comparison logic.

## 1.2 Integration Testing Guidelines (`Supertest` + Mock VCF Server)
* **Mock Server (MSW / Nock)**: Intercepts outgoing HTTP calls to `/suite-api/api/resources/stats/query` and `/suite-api/api/alerts`.
* **Database Isolation**: Integration tests execute against an isolated in-memory SQLite database (`DATABASE_URL="file::memory:"`).
* **Test Scenarios**:
  * Verify duplicate metric payload insertions are silently dropped (`INSERT OR IGNORE`).
  * Verify RBAC middleware rejects unauthenticated or `VIEWER` attempts to create VCF instance connections (`403 Forbidden`).

## 1.3 End-to-End (E2E) Testing Guidelines (`Playwright`)
* **E2E Workflows Automated**:
  1. Complete User Login flow $\rightarrow$ Verify JWT Cookie set.
  2. Navigate to Alerts Analysis page $\rightarrow$ Click severity donut segment $\rightarrow$ Verify table rows filter instantly.
  3. Navigate to Metrics Analysis page $\rightarrow$ Select `VM-007` $\rightarrow$ Toggle resolution to 5-Min Rollups $\rightarrow$ Verify chart updates.
  4. Click **"Open in VCF Operations"** button $\rightarrow$ Verify new browser tab target URL.

---

# 2. Production Deployment & Operations Runbook

## 2.1 Single-Container Deployment (Standard)
```bash
# 1. Pull latest image and bring up stack
docker compose pull
docker compose up -d --remove-orphans

# 2. Check container health status
docker compose ps

# 3. View structured backend logs
docker compose logs -f vcf-ops-app
```

## 2.2 Backup & Restore Procedures

### Automated Daily Backup Job (SQLite)
A cron job runs daily at 01:00 UTC to produce a consistent online snapshot without stopping the application:
```bash
# Execute online SQLite backup via WAL vacuum
docker exec -t vcf_federated_ops sqlite3 /app/data/vcf_ops.db ".backup /app/data/backups/vcf_ops_$(date +%Y%m%m).db"
```

### Disaster Recovery Restoration
1. Stop the application container: `docker compose down`.
2. Replace `/app/data/vcf_ops.db` with the backup file.
3. Start container: `docker compose up -d`. Prisma auto-migrations run and verify schema integrity.

---

# 3. Self-Monitoring & Operational Alerting

The application monitors its own health using internal status metrics exposed at `/readyz` and `/api/v1/system/status`:

| Health Indicator Metric | Trigger Threshold | Recommended Operator Action |
| :--- | :--- | :--- |
| **Instance Ingestion Delay** | Polling lag > 180 seconds | Check VCF Operations 9 network connectivity & API credentials. |
| **Circuit Breaker State** | State = `OPEN` | Investigate target VCF instance HTTP timeouts or 503 errors. |
| **Database File Size** | Disk usage > 10 GB | Execute manual prune script (`scripts/prune_data.ps1`) or reduce raw metric retention hours. |
| **Unprocessed DLQ Batches** | DLQ Queue > 50 records | Check disk I/O latency and database file lock locks (`PRAGMA busy_timeout`). |
