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
flowchart LR
    classDef folder fill:none,stroke:none,color:#000000,text-align:left;
    classDef file fill:none,stroke:none,color:#000000,text-align:left;

    Root["<div align='left'>📁 federated-vcf-ops</div>"]:::folder

    %% .github folder
    Root --> GH["<div align='left'>📁 .github/</div>"]:::folder
    GH --> GH1["<div align='left'>⚙️ workflows/ci.yml<br/><i>GitHub Actions CI pipeline</i></div>"]:::file
    GH --> GH2["<div align='left'>📋 ISSUE_TEMPLATE/<br/><i>Bug report & feature templates</i></div>"]:::file
    GH --> GH3["<div align='left'>📝 PULL_REQUEST_TEMPLATE.md<br/><i>Pull request guidelines</i></div>"]:::file

    %% Configuration folder
    Root --> CONF["<div align='left'>📁 Configuration/</div>"]:::folder
    CONF --> C1["<div align='left'>📄 metrics_list.yaml<br/><i>Metrics collected per object type</i></div>"]:::file
    CONF --> C2["<div align='left'>📄 alerts_list.yaml<br/><i>Alert filters monitored per object type</i></div>"]:::file

    %% Documentation folder
    Root --> DOC["<div align='left'>📁 Documentation/</div>"]:::folder
    DOC --> D1["<div align='left'>📄 Requirements.md<br/><i>Functional features & Mermaid user flows</i></div>"]:::file
    DOC --> D2["<div align='left'>📄 Solution.md<br/><i>Technical solution architecture & Mermaid ERDs</i></div>"]:::file
    DOC --> D3["<div align='left'>📄 Architecture.md<br/><i>Architecture overview & data flow</i></div>"]:::file
    DOC --> D4["<div align='left'>📄 Configuration_Guide.md<br/><i>Guide for metric & alert configuration</i></div>"]:::file

    %% src folder
    Root --> SRC["<div align='left'>📁 src/</div>"]:::folder
    SRC --> B["<div align='left'>📁 backend/<br/><i>Node.js Ingestion Engine, DB & REST API</i></div>"]:::folder
    SRC --> F["<div align='left'>📁 frontend/<br/><i>React 18 Web UI Pages & Components</i></div>"]:::folder

    %% scripts folder
    Root --> SCR["<div align='left'>📁 scripts/</div>"]:::folder
    SCR --> S1["<div align='left'>📜 prune_data.ps1<br/><i>Database retention cleanup script</i></div>"]:::file

    %% Root configuration files
    Root --> ENV["<div align='left'>🔑 .env.example<br/><i>Environment variables template</i></div>"]:::file
    Root --> DOCK["<div align='left'>🐳 Dockerfile & docker-compose.yml<br/><i>Production container specifications</i></div>"]:::file
    Root --> PKG["<div align='left'>📦 package.json<br/><i>Node.js project configuration</i></div>"]:::file
    Root --> READ["<div align='left'>📖 README.md & LICENSE<br/><i>Repository overview & MIT License</i></div>"]:::file
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
