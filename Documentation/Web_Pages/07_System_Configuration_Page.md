# Page 7: System & VCF Configuration Page

* **Route**: `/settings`
* **Target Audience**: System Administrators.
* **Primary Goal**: Manage VCF Operations 9 instance connections, configure authentication credentials (Local `OpsToken` vs. VCF SSO `Bearer Token`), adjust polling frequency, and configure data retention rules.

---

## 📐 Visual Layout & Wireframe

```
+-----------------------------------------------------------------------------------------+
| VCF OPERATIONS INSTANCES MANAGEMENT                      [ + Add VCF Instance ]         |
+-----------------------------------------------------------------------------------------+
| Instance Name | Hostname / IP      | Auth Type    | Polling Interval | Status           |
|---------------+--------------------+--------------+------------------+------------------|
| VCF-Ops-01    | vcf-ops-01.corp    | OpsToken     | 60 seconds       | [Healthy] [Edit] |
| VCF-Ops-02    | vcf-ops-02.corp    | Bearer (VIDB)| 60 seconds       | [Healthy] [Edit] |
+-----------------------------------------------------------------------------------------+
| MODAL: ADD / EDIT VCF INSTANCE CONNECTION                                               |
| Instance Name: [ VCF-Ops-03                          ]                                  |
| Hostname / IP: [ vcf-ops-03.corp.local               ]                                  |
|                                                                                         |
| AUTHENTICATION METHOD:                                                                  |
| ( ) Option A: Local Credentials (OpsToken) - VCF 9.0 & Local                            |
|     Username:    [ admin                        ]                                       |
|     Password:    [ ********************         ]                                       |
|     Auth Source: [ LOCAL                        ]                                       |
|                                                                                         |
| (o) Option B: VCF SSO / VIDB API Token (Bearer Token) - VCF 9.1+ Best Practice          |
|     VIDB Host:          [ vidb.corp.local       ]                                       |
|     Client Name / ID:   [ federated-ops-client  ]                                       |
|     API Refresh Token:  [ ********************  ]                                       |
|                                                                                         |
| [ Test Connection ]                                               [ Save Instance ]    |
+-----------------------------------------------------------------------------------------+
| RETENTION & SYSTEM SETTINGS                                                             |
| - Raw 1-Min Metrics Retention: [ 48 ] Hours                                             |
| - Summary Rollups Retention:   [ 90 ] Days                                              |
| - Auto-Prune Daily Execution:  [ 00:00 ] UTC                                            |
|                                                                    [ Save System Settings]|
+-----------------------------------------------------------------------------------------+
```

---

## ⚡ Key Functions & Controls

1. **Instance Management Table**: Lists all registered VCF Operations instances with real-time health badges (`Healthy`, `Unreachable`, `Auth Error`).
2. **Dual Authentication Configuration Modal**:
   * **Option A (Local OpsToken)**: Input fields for Username, Password, and Auth Source.
   * **Option B (VCF SSO Bearer Token)**: Input fields for VIDB Host, Client ID, and API Refresh Token.
3. **Test Connection Action Button**: Calls `POST /api/v1/instances/test` to validate credentials and REST API reachability before saving.
4. **Retention Policy Form**: Configures retention duration for raw 1-minute metrics (hours) and summary rollup metrics (days).

---

## 🔌 API Endpoints & State Machine

* `GET /api/v1/instances`: Retrieves list of registered VCF Operations instances.
* `POST /api/v1/instances`: Registers a new VCF Operations instance.
* `POST /api/v1/instances/test`: Tests connection and credentials for candidate instance.
* `PUT /api/v1/system/settings`: Updates global system settings and data retention policies.
