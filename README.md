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

```
.
├── .github/                     # GitHub Workflows and Issue/PR templates
│   ├── workflows/ci.yml         # GitHub Actions CI pipeline
│   ├── ISSUE_TEMPLATE/          # Bug report and feature request templates
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md # Pull Request description guidelines
├── Configuration/               # Human-friendly YAML collection configs
│   ├── metrics_list.yaml        # Metrics collected per object type
│   └── alerts_list.yaml         # Alert filters monitored per object type
├── Documentation/               # Technical Specifications, User Guides & Engineering Specifications
│   ├── Architecture.md          # Unified Technical Architecture & System Design
│   ├── Requirements.md          # Functional & technical requirements (with Mermaid user flows)
│   ├── Pages_Specification.md   # Web pages inventory, wireframes & UI state machine
│   ├── Guides/                  # User & Administrator Guides
│   │   ├── Installation_Guide.md
│   │   ├── Configuration_Guide.md
│   │   ├── User_Guide.md
│   │   ├── Troubleshooting_Guide.md
│   │   └── Limitations_and_Roadmap.md
│   └── Engineering/             # Software Developer Specifications & OpenAPI Schema
│       ├── Backend_Developer_Guide.md
│       ├── Frontend_Developer_Guide.md
│       ├── OpenAPI_Spec.yaml
│       └── Testing_and_Operations_Guide.md
├── src/                         # Application Source Code Scaffolding
│   ├── backend/                 # Node.js Ingestion Engine, DB & REST API
│   │   ├── api/                 # REST routes
│   │   ├── db/                  # Database models & migrations
│   │   ├── ingestion/           # Polling scheduler & watermark manager
│   │   └── index.ts             # Backend entry point
│   └── frontend/                # React 18 Web UI
│       └── pages/               # Home, Alerts, & Metrics pages
├── scripts/                     # Operational scripts
│   └── prune_data.ps1           # Database retention cleanup script
├── .env.example                 # Environment variables configuration template
├── .gitignore                   # Standard gitignore (Node, Docker, SQLite, OS)
├── Dockerfile                   # Multi-stage production container manifest
├── docker-compose.yml           # Production Docker Compose orchestration
├── LICENSE                      # MIT Open Source License
└── README.md                    # Primary repository landing overview with badges
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

## 📖 Key Documentation & Specifications

### Architecture & Requirements
* 📐 [Unified Architecture & System Design](Documentation/Architecture.md)
* 📋 [Requirements Specification](Documentation/Requirements.md)
* 🖥️ [Pages & UI Wireframe Specification](Documentation/Pages_Specification.md)

### User & Operational Guides
* ⚡ [Installation Guide](Documentation/Guides/Installation_Guide.md)
* ⚙️ [Configuration Guide](Documentation/Guides/Configuration_Guide.md)
* 👤 [User Guide](Documentation/Guides/User_Guide.md)
* 🔧 [Troubleshooting Guide](Documentation/Guides/Troubleshooting_Guide.md)
* 🛑 [Limitations & Roadmap](Documentation/Guides/Limitations_and_Roadmap.md)

### Developer & Engineering Specifications
* 🛠️ [Backend Developer Guide](Documentation/Engineering/Backend_Developer_Guide.md)
* 🎨 [Frontend Developer Guide](Documentation/Engineering/Frontend_Developer_Guide.md)
* 📄 [OpenAPI 3.0 Specification (YAML)](Documentation/Engineering/OpenAPI_Spec.yaml)
* 🧪 [Testing & Operations Guide](Documentation/Engineering/Testing_and_Operations_Guide.md)

---

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
