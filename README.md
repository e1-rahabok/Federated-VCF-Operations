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
│   └── PULL_REQUEST_TEMPLATE.md # PR description guidelines
├── Configuration/               # YAML Metric & Alert Collection Rules
│   ├── metrics_list.yaml        # Metrics collected per object type
│   └── alerts_list.yaml         # Alert filters monitored per object type
├── docs/                        # Operational & Technical Documentation
│   ├── ARCHITECTURE.md          # Architecture overview & component relationships
│   └── CONFIGURATION_GUIDE.md   # Guide for configuring metric/alert rules
├── src/                         # Application Source Code
│   ├── backend/                 # Node.js Ingestion Engine & REST API
│   │   ├── api/                 # REST endpoints & routes
│   │   ├── db/                  # Database models, migrations, & watermarking
│   │   ├── ingestion/           # 1-min polling scheduler & delta fetcher
│   │   └── services/            # Token management, rollups, & retention purger
│   └── frontend/                # React 18 Web UI
│       ├── components/          # Reusable UI widgets, charts, and tables
│       ├── pages/               # Home, Alerts, Metrics, & Settings pages
│       └── services/            # API client layer
├── scripts/                     # Utility scripts (backup, DB pruning)
├── .env.example                 # Environment variables configuration template
├── .gitignore                   # Git ignore specifications
├── Dockerfile                   # Application container specification
├── docker-compose.yml           # Production Compose orchestration
├── REQUIREMENTS.md              # Functional & Technical Requirements Specification
└── SOLUTION.md                  # Comprehensive Solution Architecture Document
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

* [Functional & Technical Requirements](REQUIREMENTS.md)
* [Technical Solution Architecture](SOLUTION.md)
* [Architecture Guide](docs/ARCHITECTURE.md)
* [Configuration Guide](docs/CONFIGURATION_GUIDE.md)

---

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
