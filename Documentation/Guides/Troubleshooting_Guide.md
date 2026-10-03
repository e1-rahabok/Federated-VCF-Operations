# Troubleshooting Guide

This guide provides diagnostic procedures and resolution steps for common operational issues in the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

# 1. Self-Monitoring & Health Diagnostics

The application exposes real-time operational diagnostic endpoints:

* **`/healthz`**: Returns HTTP 200 OK if Express server is running.
* **`/readyz`**: Returns HTTP 200 OK if SQLite/PostgreSQL connection is responsive.
* **`/api/v1/system/status`**: Detailed payload showing active polling workers, database size, memory usage, and per-instance collection status.

```bash
# Check system status payload via curl
curl http://localhost:3000/api/v1/system/status
```

---

# 2. Common Operational Issues & Solutions

## Issue 1: VCF Instance Health Status = `UNREACHABLE` or `DEGRADED`

### Symptoms
* Health badge on `/settings` displays `UNREACHABLE` or `DEGRADED`.
* Alerts or metrics for that instance stop updating.

### Root Causes & Fixes
1. **Invalid API Credentials or Token Expiration**:
   * *Fix*: Go to **Settings (`/settings`)** $\rightarrow$ Edit Instance $\rightarrow$ Click **"Test Connection"**.
   * If using **Option B (VCF SSO Bearer Token)**, ensure the API Refresh Token hasn't exceeded its max TTL in VCF Operations (`Fleet Management -> Identity & Access`).
2. **TLS Certificate Rejection**:
   * *Fix*: If target VCF instance uses a self-signed SSL certificate, ensure `rejectUnauthorized` is disabled for that instance in Settings or set `NODE_TLS_REJECT_UNAUTHORIZED=0` in `.env`.
3. **Circuit Breaker Tripped (`OPEN` State)**:
   * *Fix*: If 5 consecutive HTTP timeouts occur within 60s, the circuit breaker trips to `OPEN` for 60 seconds to prevent thread starvation. Check network firewall connectivity to port 443 on the target instance.

---

## Issue 2: Ingestion Delays or Duplicate Metrics Warnings

### Symptoms
* Metric timestamps lag behind real-time by more than 3 minutes.
* Log messages report `[Watermark] Skipping cycle, previous run still processing`.

### Root Causes & Fixes
1. **Slow Network or VCF Operations API Latency**:
   * *Fix*: Increase request timeout in `.env` (`API_TIMEOUT_SECONDS=30`) or increase polling interval (`POLLING_INTERVAL_SECONDS=120`).
2. **Database Write Lock (`SQLITE_BUSY`)**:
   * *Fix*: Ensure SQLite WAL mode is enabled (`PRAGMA journal_mode=WAL`). Increase `PRAGMA busy_timeout=5000`.

---

## Issue 3: High Disk Space Consumption

### Symptoms
* Server disk space alert triggers; SQLite `vcf_ops.db` file exceeds 10 GB.

### Root Causes & Fixes
1. **Raw Metric Retention Window Too Long**:
   * *Fix*: Reduce raw 1-minute metric retention in `.env` (`RETENTION_RAW_HOURS=24`).
2. **Unclaimed Free Pages in Database**:
   * *Fix*: Run the database maintenance script to purge expired data and reclaim disk pages:
     ```powershell
     powershell -File ./scripts/prune_data.ps1
     ```

---

# 3. Log Diagnostics

Structured JSON logs are emitted to `stdout`. Use `grep` or `jq` to filter logs by instance or severity:

```bash
# Inspect Docker container logs
docker compose logs -f vcf-ops-app | grep "ERROR"

# Filter logs for a specific VCF instance
docker compose logs vcf-ops-app | jq 'select(.instance_id=="VCF-Ops-01")'
```
