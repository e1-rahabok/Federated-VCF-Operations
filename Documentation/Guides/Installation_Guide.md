# Installation Guide

This guide describes how to deploy the Federated VMware Cloud Foundation (VCF) Operations 9 Web Application.

---

## 1. Fast Track: Single-Command Docker Deployment (Recommended)

The recommended production deployment uses Docker Compose. It bundles the web server, background ingestion engine, and SQLite database into a single container.

### Prerequisites
* **Docker Engine**: v20.10+
* **Docker Compose**: v2.0+
* **Network Connectivity**: HTTPS access (port 443) to target VCF Operations 9 instances.

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/federated-ops/vcf-ops.git
cd vcf-ops

# 2. Copy the environment configuration template
cp .env.example .env

# 3. Generate a secret master encryption key in .env
# (Used to encrypt stored VCF passwords via AES-256-GCM)

# 4. Launch the application container
docker compose up -d

# 5. Verify container status
docker compose ps
```

The web console is immediately accessible at **`http://<server-ip>:3000`**.

---

## 2. Bare-Metal / Local Node.js Setup

For development or non-containerized environments:

### Prerequisites
* **Node.js**: v18.x or v20.x
* **npm**: v9.x or v10.x

### Installation Steps

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Run database migrations
npm run db:migrate

# 4. Start production server
npm run build
npm run start
```

---

## 3. Post-Installation Verification

1. Open your web browser to `http://localhost:3000`.
2. You will be greeted by the **User Login Page**.
3. Log in with the default administrator credentials:
   * **Username**: `admin`
   * **Password**: `admin` (Change immediately upon initial sign-in).
4. Proceed to the **System Settings** page (`/settings`) to connect your VCF Operations 9 instances.
