# Engineering Development Standards & Anti-Mocking Policy

This document defines the quality assurance and development standards for the Federated VCF Operations 9 project.

---

## 1. Zero-Mocks Policy

1. **No Static Table Templates**: Tables displaying operational infrastructure entities (instances, objects, alerts, metric configurations) must dynamically bind to REST API responses backed by SQLite or configuration files.
2. **No Synthetic Wave Generators**: Visual charts must never use `Math.sin()` or `Math.random()` to generate telemetry points. All timeseries datasets must be fetched via `/api/v1/metrics/query` from SQLite `raw_metrics` or `summary_metrics`.
3. **No Stubbed Popups**: User operations such as saving instances, altering retention policies, or triggering CSV exports must never be stubbed with `alert()`. All mutations must execute real HTTP methods (`POST`, `PUT`, `DELETE`), and CSV buttons must trigger genuine file downloads.

---

## 2. Real State Mutation & Integration Testing

1. **Lifecycle Assertions**: Tests must not merely check HTTP 200 response codes. Tests must perform real state mutations (e.g. creating an instance via `POST /api/v1/instances` or saving a metric key to `metrics_list.yaml`), execute queries against the endpoint, and assert that the mutated data appears in the response.
2. **Virtual DOM Execution**: Client-side single page application scripts must be verified using Node's `node:vm` `Script` interface with mock DOM execution, confirming that UI views render non-empty data rows from live API responses.

---

## 3. Safe Scripting & Architectural Boundaries

1. **Code Separation**: Logic must be cleanly separated into `src/backend/` and `src/frontend/`.
2. **String Interpolation Safety**: Server HTML templates must not contain unescaped regex backslashes (`\s`, `\n`) that degrade during template evaluation. Use robust string parsing primitives (`indexOf`, `substring`, `trim`).
