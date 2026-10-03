# Federated VMware Cloud Foundation (VCF) Operations 9 Web Application

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VCF Operations](https://img.shields.io/badge/VCF%20Operations-9.0-orange.svg)](https://developer.broadcom.com/xapis/vcf-operations-api/latest/)
[![Build Status](https://github.com/federated-ops/vcf-ops/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)

A centralized, multi-instance monitoring web application for VMware Cloud Foundation (VCF) Operations 9. 

It polls metrics, objects, and alerts every 1 minute from multiple VCF Operations 9 instances, enforces fast non-duplicate ingestion via high-watermarking, computes compact summary metric rollups, and provides rich interactive dashboards for alert triage and metric analysis.

---

## 🌟 Key Features

* **Multi-Instance Aggregation**: Monitor multiple VCF Operations 9 environments concurrently from a single unified portal.
* **Fast & Light Delta Ingestion**: High-watermarking algorithm (`last_polled_timestamp`) queries metric and alert deltas without collecting duplicates.
* **Compact Relational Storage**: High-resolution 1-minute raw metrics buffer auto-purges after 48 hours, while pre-computed 5-minute and 1-hour summary rollups are retained long-term (default 90 days).
* **Personalized Home Page**: Each user can customize their dashboard with pinned objects and active alerts widgets.
* **Alerts Analysis Workspace**: Interactive timeline stacked bar charts, severity donuts, top alerting objects, multi-column search, and deep links to native VCF Operations 9 instances.
* **Metrics Analysis Explorer**: Comparative multi-metric chart overlay, synchronized drag-to-zoom, statistical percentile cards (`P95`/`P99`), and resolution toggles (`1-min`, `5-min`, `1-hour`).
* **YAML-based Collection Config**: Easy-to-read configuration files (`Configuration/metrics_list.yaml` & `alerts_list.yaml`) grouped by object type (`VirtualMachine`, `HostSystem`, `ClusterComputeResource`, `Datastore`).

---

## 📁 Repository Directory Layout

```mermaid
flowchart TD
    classDef folder fill:#1e293b,stroke:#38bdf8,stroke-width:1px,color:#f8fafc,text-align:left;
    classDef file fill:#0f172a,stroke:#64748b,stroke-width:1px,color:#cbd5e1,text-align:left;

    Root["📁 federated-vcf-ops (Repository Root)"]:::folder

    GH["📁 .github/ — GitHub Workflows & Issue/PR templates"]:::folder
    GH_CI["⠀ ├── ⚙️ workflows/ci.yml — GitHub Actions CI build pipeline"]:::file
    GH_IT["⠀ ├── 📋 ISSUE_TEMPLATE/ — Bug report & feature templates"]:::file
    GH_PR["⠀ └── 📝 PULL_REQUEST_TEMPLATE.md — PR guidelines"]:::file

    CONF["📁 Configuration/ — YAML Metric & Alert Collection Rules"]:::folder
    CONF_M["⠀ ├── 📄 metrics_list.yaml — Performance metrics collected per object type"]:::file
    CONF_A["⠀ └── 📄 alerts_list.yaml — Alert filters monitored per object type"]:::file

    DOC["📁 Documentation/ — Technical Specifications & Operational Guides"]:::folder
    DOC_R["⠀ ├── 📄 Requirements.md — Functional features & Mermaid user flow diagrams"]:::file
    DOC_S["⠀ ├── 📄 Solution.md — Technical solution architecture & Mermaid ERDs"]:::file
    DOC_A["⠀ ├── 📄 Architecture.md — Architecture overview & component relationships"]:::file
    DOC_C["⠀ └── 📄 Configuration_Guide.md — Guide for configuring metric/alert rules"]:::file

    SRC["📁 src/ — Application Source Code Scaffolding"]:::folder
    SRC_B["⠀ ├── 📁 backend/ — Node.js Ingestion Engine, DB models & REST API"]:::file
    SRC_F["⠀ └── 📁 frontend/ — React 18 Web UI (Pages & Components)"]:::file

    SCR["📁 scripts/ — Utility Scripts"]:::folder
    SCR_P["⠀ └── 📜 prune_data.ps1 — Database retention cleanup script"]:::file

    ENV["🔑 .env.example — Environment variables configuration template"]:::file
    DOCK["🐳 Dockerfile & docker-compose.yml — Production container specifications"]:::file
    PKG["📦 package.json — Node.js project dependencies & build scripts"]:::file
    READ["📖 README.md & LICENSE — Project documentation & MIT License"]:::file

    Root --> GH
    GH --> GH_CI --> GH_IT --> GH_PR
    GH_PR --> CONF
    CONF --> CONF_M --> CONF_A
    CONF_A --> DOC
    DOC --> DOC_R --> DOC_S --> DOC_A --> DOC_C
    DOC_C --> SRC
    SRC --> SRC_B --> SRC_F
    SRC_F --> SCR
    SCR --> SCR_P
    SCR_P --> ENV --> DOCK --> PKG --> READ
```

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v18.x or v20.x
* **Docker & Docker Compose** (for containerized setup)
* **Access**: Credentials for target VCF Operations 9 instances

### 1. Local Setup
```bash
# Clone the repository
git clone https://github.com/your-org/federated-vcf-ops.git
cd federated-vcf-ops

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### 2. Docker Compose Deployment
```bash
# Copy and configure environment variables
cp .env.example .env

# Start application container in background
docker compose up -d

# Verify container status
docker compose ps
```

The web console will be accessible at `http://localhost:3000`.

---

## 📖 Key Documentation

* [Functional & Technical Requirements](Documentation/Requirements.md)
* [Technical Solution Architecture](Documentation/Solution.md)
* [Architecture Guide](Documentation/Architecture.md)
* [Configuration Guide](Documentation/Configuration_Guide.md)

---

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
