# Backend Developer Guide & Architectural Best Practices

This document defines the software engineering standards, backend design patterns, resilience mechanisms, and operational best practices for the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

# 1. Architectural Pattern: Clean Layered Architecture

The backend codebase is structured using **Clean Layered Architecture**.
Dependencies flow inward towards domain models. No outer layer leaks directly into business logic.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CONTROLLER / API GATEWAY LAYER                    │
│   Express / Fastify Routes, Zod Request Validation, HTTP Response Mapper│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Calls
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVICE / BUSINESS LAYER                       │
│   Aggregation Engine, Token Manager, Watermark Logic, Rollup Engine     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Calls
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       REPOSITORY / DATA ACCESS LAYER                    │
│   Prisma / Kysely ORM, SQL Parameterized Queries, Transaction Manager   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Reads/Writes
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE & ADAPTER LAYER                   │
│   VCF Operations REST Adapters, VIDB OAuth Client, SQLite/Postgres DB   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Module Boundary Rules
* **Controllers** handle HTTP protocols, query parameter parsing, and response formatting. They NEVER contain SQL or VCF API HTTP calls.
* **Services** contain core business logic (e.g. non-duplicate checking, rollup math). They are pure TypeScript classes decoupled from Express.
* **Repositories** encapsulate database queries. Direct raw SQL is prohibited outside repository classes.
* **Adapters** encapsulate external HTTP communications with VCF Operations 9 and VIDB SSO endpoints.

---

# 2. Ingestion Resilience & Data Engineering Patterns

## 2.1 High-Watermarking & Idempotent Processing
To ensure zero duplicate data ingestion across 1-minute collection cycles:
1. **Watermark Locks**: Before initiating an ingestion cycle for VCF Instance $X$, the worker acquires an in-memory lock (`instance_locks`). If an instance is still processing a previous slow cycle, the new cycle is skipped to prevent backpressure accumulation.
2. **Delta Bounds**: The query payload to VCF Operations uses `begin = last_polled_timestamp + 1`.
3. **Database Idempotency**:
   ```sql
   -- Composite Unique Index
   CREATE UNIQUE INDEX idx_raw_metrics_idempotency 
   ON raw_metrics (instance_id, resource_uuid, stat_key, timestamp);

   -- Idempotent Bulk Insert Statement
   INSERT INTO raw_metrics (instance_id, resource_uuid, stat_key, timestamp, stat_value)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT (instance_id, resource_uuid, stat_key, timestamp) DO NOTHING;
   ```

## 2.2 Circuit Breaker Pattern for Unresponsive VCF Instances
When a VCF Operations 9 instance experiences an outage, network partitioning, or high API latency, the **Circuit Breaker** prevents resource exhaustion on the monitoring application.

```
       +---------------------------------------------------+
       |                                                   |
       v                                                   |
  +--------+   Failures > 5 / 60s   +--------+             |
  | CLOSED | ---------------------> |  OPEN  |             | Success
  +--------+                        +--------+             |
      ^                                 |                  |
      |                                 | Timeout (60s)    |
      |         Success (2 calls)       v                  |
      +---------------------------- +-----------+          |
                                    | HALF-OPEN | ---------+
                                    +-----------+
```

* **States**:
  * **CLOSED (Normal Operation)**: All API calls pass through to VCF Operations.
  * **OPEN (Tripped Failure State)**: After 5 consecutive HTTP timeouts or 5xx errors within 60 seconds, the breaker trips. API calls for that instance are immediately short-circuited (0ms delay) without hitting the network.
  * **HALF-OPEN (Probe State)**: After a 60-second cooldown, the breaker allows 2 test requests through. If successful, state resets to `CLOSED`; if failed, resets to `OPEN`.

## 2.3 Dead Letter Queue (DLQ) & Failed Batch Recovery
If a payload batch fails to write to the database (e.g., temporary disk lock or corrupted record):
* The batch is written to an in-memory / local disk **Dead Letter Queue (DLQ)** (`/data/dlq_failed_batches.json`).
* A background retry worker attempts re-insertion every 5 minutes (up to 3 retries).
* If retries fail after 3 attempts, an administrative alert is logged and visible on `/settings`.

## 2.4 Rate Limiting & Backpressure Management
* **Worker Pool Concurrency**: Polling across 20 VCF instances uses a bounded concurrency queue (`p-limit` set to 5 parallel instances max) to avoid network socket exhaustion.
* **HTTP Connection Reuse**: Axios / Fetch HTTP agents enforce Keep-Alive socket pools:
  ```typescript
  import http from 'http';
  import https from 'https';

  export const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
  export const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
  ```

---

# 3. Database Engineering & Performance Optimization

## 3.1 SQLite WAL Mode & Connection Pooling
* **Write-Ahead Logging (WAL)**: SQLite database connections execute the following pragmas on startup:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  ```
  WAL mode allows concurrent HTTP read queries while background ingestion workers execute bulk writes.

* **PostgreSQL Connection Pooling**:
  When deployed against PostgreSQL, connection pool size is capped at:
  $$\text{Pool Size} = (\text{CPU Cores} \times 2) + \text{Effective Spindle Count}$$

## 3.2 Index Selectivity & Query Optimization
All core query paths are covered by composite B-Tree indexes:

| Table | Index Columns | Query Path Target |
| :--- | :--- | :--- |
| `resources` | `(instance_id, resource_kind)` | Resource tree selector sidebar |
| `raw_metrics` | `(instance_id, resource_uuid, stat_key, timestamp DESC)` | 1-minute high-resolution chart rendering |
| `summary_metrics` | `(instance_id, resource_uuid, stat_key, time_bucket DESC, granularity)` | 5-minute / 1-hour rollup chart rendering |
| `alerts` | `(instance_id, resource_uuid, status, alert_level, update_time DESC)` | Alerts analysis slicing and dicing grid |

---

# 4. Security Hardening & OWASP Compliance

1. **Authentication & Session Security**:
   * JWT session tokens signed with HS256 / RS256 algorithms.
   * Tokens stored in HTTP-only, SameSite=Strict, Secure cookies to prevent XSS theft.
2. **Credential Encryption at Rest**:
   * Sensitive fields (`password_encrypted`, `api_token_encrypted`) use **AES-256-GCM** authenticated encryption:
     $$\text{Ciphertext} = \text{AES-256-GCM}(\text{Plaintext Password}, \text{Master Key}, \text{IV})$$
3. **HTTP Security Headers (Helmet)**:
   ```typescript
   import helmet from 'helmet';
   app.use(helmet({
     contentSecurityPolicy: true,
     crossOriginEmbedderPolicy: true,
     referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
   }));
   ```
4. **Input Validation**: All incoming REST API parameters are validated using strict Zod schemas to reject invalid payloads or malicious injection vectors.

---

# 5. Observability, Logging & Diagnostics

## 5.1 Structured JSON Logging
All backend events are emitted as single-line JSON log objects to `stdout` / `stderr`:

```json
{
  "timestamp": "2026-10-03T10:15:30.124Z",
  "level": "info",
  "service": "vcf-ingestion",
  "instance_id": "vcf-ops-01",
  "cycle_duration_ms": 1240,
  "metrics_collected": 14500,
  "alerts_collected": 12,
  "trace_id": "7f8a9b0c-1234-5678"
}
```

## 5.2 Metrics & Health Endpoints
* **`/healthz`**: Liveness probe (Returns HTTP 200 OK if Express web server is alive).
* **`/readyz`**: Readiness probe (Returns HTTP 200 OK if database connection and WAL file are responsive).
* **`/api/v1/system/status`**: Detailed diagnostic payload including memory usage, active workers, circuit breaker states, and database size.

---

# 6. Graceful Shutdown & Process Lifecycle

Backend servers handle process signals (`SIGTERM`, `SIGINT`) cleanly:

```typescript
const shutdown = async (signal: string) => {
  console.log(`[Process] Received ${signal}. Starting graceful shutdown...`);
  
  // 1. Stop accepting new HTTP requests
  server.close(() => console.log('[HTTP] Server closed.'));
  
  // 2. Stop ingestion scheduler timer
  scheduler.stop();
  
  // 3. Flush in-memory metrics and complete active DB write transactions
  await ingestionWorker.flush();
  
  // 4. Safely close database connection pool
  await db.close();
  
  console.log('[Process] Graceful shutdown completed. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```
