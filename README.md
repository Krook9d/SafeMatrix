<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/Krook9d/SafeMatrix">
    <img src="/frontend/src/assets/connectors/SafeMatrix_title.svg" alt="SafeMatrix Logo" width="400" height="400" />
  </a>

  <!-- PROJECT SHIELDS -->
  
  [![Issues][issues-shield]][issues-url]
  [![MIT License][license-shield]][license-url]
  [![LinkedIn][linkedin-shield]][linkedin-url]
  [![Forks][forks-shield]][forks-url]
  [![Stargazers][stars-shield]][stars-url]
</div>

# SafeMatrix

A security analytics and orchestration platform focused on centralized vulnerability collection and automated response workflows.
The system aggregates vulnerability data from multiple sources and applies customizable rules to automatically trigger the right action through built-in connectors: notify the appropriate team by email, open a ServiceNow incident, create a Jira ticket, or generate a case in TheHive.

Lightweight endpoint telemetry (via optional Go agents, currently in beta) provides complementary software inventory data, while the Python FastAPI backend enriches findings and exposes them through a modern React dashboard.
The platform acts as a unified control plane to detect vulnerabilities faster and orchestrate consistent, automated remediation across your organization.

---

## Key Features

- **Unified inventory**
  - Go agents on endpoints collect installed software and versions periodically.
  - Centralized view of hosts, operating systems and installed applications.

- **Vulnerability enrichment**
  - Automated synchronization with the **NVD API 2.0** (National Vulnerability Database).
  - Optional enrichment from additional public feeds (e.g. CISA KEV, FediSec).
  - CVSS scores, CWE, CPE, and contextual data for each CVE.

- **Security analytics dashboard**
  - Modern **React + MUI** frontend.
  - KPIs and charts (vulnerability distribution, most exposed hosts, latest CVEs, etc.).
  - Detailed host and software views with associated vulnerabilities.
  - Search and filtering capabilities powered by the backend API and OpenSearch.

- **Scalable and containerized**
  - Docker Compose environment (backend, frontend, PostgreSQL, OpenSearch, Redis, optional dashboards).
  - Agents installed directly on monitored endpoints.

- **Strong authentication, RBAC and admin workflows**
	- JWT-based authentication with hashed passwords stored in **PostgreSQL**.
	- Three roles: `admin`, `analyst`, `viewer`.
	- Initial admin can be bootstrapped via environment variables; optional self-signup forces new accounts to `viewer`.
	- Admin-only access to sensitive areas: user management, audit logs, data-enrichment controls, and configuration of **connectors** and **automation workflows**.

---

## High-Level Architecture

SafeMatrix is composed of four main parts: agents, backend, storage and frontend.

<img src="/frontend/public/screenshot/Architecture.png" width="800" alt="Architecture">

- **Go Agents**
  - Background service/daemon on Windows, Linux and macOS.
  - Collect installed software inventories every few minutes.
  - Push JSON payloads over HTTPS to the backend API.

- **FastAPI Backend (Python)**
  - Receives inventories from agents.
  - Enriches software and versions with external vulnerability sources.
  - Stores hosts, inventories and vulnerabilities in OpenSearch.
  - Manages users, roles, authentication and sessions via PostgreSQL and JWT.
  - Exposes REST APIs for:
    - Agent ingestion
    - Dashboard queries (hosts, inventories, vulnerabilities, statistics)
    - Administration (users, settings, NVD sync, etc.)

- **Storage**
  - **PostgreSQL**
    - Users, credentials (hashed), roles and related metadata.
  - **OpenSearch**
    - `hosts` index: one document per host (id, name, OS, IP, etc.).
    - `inventories` index: software inventory for each host, with version, timestamp and vulnerability list.
    - Optional logs/alerts indices.

- **React Frontend**
  - Vite + React 18 + TypeScript.
  - Material-UI component library.
  - React Router for navigation.
  - Axios for API communication.

---

## Quick Start

### 1. Backend: Local Development Setup

From the `backend/` directory:

1. **Create a virtual environment**

   ```bash
   python3 -m venv venv
   ```

2. **Activate the virtual environment**

   - Windows (PowerShell):

     ```powershell
     .\venv\Scripts\Activate.ps1
     ```

   - macOS / Linux:

     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies**

Install Microsoft C++ Build Tools

```bash
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**

   Copy the example file and adjust values:

   ```bash
   cp backend/.env.exemple backend/.env
   ```

   In `backend/.env` you can set for example:

   ```env
   NVD_TOKEN_API=your-nvd-token
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-strong-password
   ALLOW_SELF_SIGNUP=false
   ```

   - `NVD_TOKEN_API` is recommended for better NVD rate limits.
   - `ALLOW_SELF_SIGNUP=false` enforces admin-only provisioning.

5. **(Optional) Gmail configuration for email notifications**

   - Edit `update_gmail_config.sql` and replace:
     - `YOUR_GMAIL_ADDRESS` with your Gmail address.
     - `YOUR_GMAIL_APP_PASSWORD` with your Gmail App Password (generated from https://myaccount.google.com/security).
   - Apply the configuration to PostgreSQL (example):

     ```bash
     cmd /c "docker exec -e PGPASSWORD=password -i postgres_db psql -v ON_ERROR_STOP=1 -U user -d main_db < update_gmail_config.sql"
     ```

---

### 2. Start Core Services (Docker)

From the **project root** (the folder containing `docker-compose.yml`):

```bash
docker compose up --build -d
```

```bash
uvicorn backend.main:app --reload
```

The API will be available at:

- `http://127.0.0.1:8000`

This starts PostgreSQL, OpenSearch, Redis, the backend, and the frontend (depending on your compose configuration).

To stop services:

```bash
docker compose down
```

> Note: some commands in legacy docs may still use `docker-compose`. Modern Docker uses `docker compose`.

---

Once the containers are running, the frontend is available at `http://localhost:5173`.

---

## User & Role Management

SafeMatrix enforces **admin-only user creation** by default.

- **Roles**
  - `admin` – Full access. Can manage users, connectors, workflows and advanced settings.
  - `analyst` – Operational usage of the platform, no user administration.
  - `viewer` – Read-only access to dashboards and data.

- **Provisioning model**
  - Public signup is disabled by default (`ALLOW_SELF_SIGNUP=false`).
  - You bootstrap the first admin via environment variables at backend startup.
  - If `ALLOW_SELF_SIGNUP=true`, self-registration is allowed but every new account is forced to role `viewer`.

- **Frontend access (admin only)**
  - Log in as an `admin` user.
  - Navigate to the **Users** page (only visible to admins):
    - Route: `/admin/users`
  - From there you can:
    - Create users (username, password, role).
    - Update user roles.
    - Delete users.

- **Authentication details**
  - JWT bearer tokens stored in `localStorage` under key `access_token`.
  - `authAPI.getCurrentUser()` is used by the frontend to resolve the current user and role.

---

## Connectors & Workflows

SafeMatrix allows you to plug external systems into your detection and response workflows.

- **Connectors (integrations)**
  - Managed from the **Connectors** page in the UI (admin area).
  - Supported connector types include:
    - **Email** – send notification emails via SMTP (host, port, credentials, TLS, from address).
    - **TheHive** – create cases/alerts in TheHive using an API key.
    - **ServiceNow** – open incidents in a ServiceNow instance (URL, table, credentials).
    - **Jira** – create issues in Jira Cloud/Data Center (URL, email, API token, optional issue type).
  - Each connector has:
    - A **name**, **type**, JSON **config**, and an **enabled/disabled** flag.
    - A built-in **Test** action to validate connectivity and credentials.

- **Automation workflows**
  - Designed to react to alerts, vulnerabilities or inventory changes.
  - Configured from the **Workflows** section in the UI.
  - A workflow typically defines:
    - **Triggers** (e.g. conditions on severity, asset, tag, etc.).
    - One or more **actions** that rely on connectors (send email, create TheHive case, open ServiceNow/Jira ticket, …).
  - When a workflow runs, it selects the appropriate, **enabled** connectors and uses their configuration to execute actions.

- **Access control**
  - Only **admin** users can create, edit or delete connectors and workflows.
  - Analysts/viewers can see the results (alerts, tickets, emails) but cannot change integration settings.

<img src="/frontend/public/screenshot/workflowdraw.png" width="800" alt="Architecture">

---

## Vulnerability Data Enrichment (NVD Sync)

SafeMatrix provides an automated CVE synchronization mechanism with NVD, controlled from the admin UI.

### Features

- Start NVD synchronization from the **Data Enrichment** page in the settings.
- Real-time progress updates (CVE count refreshed every few seconds).
- Background job execution so the application remains responsive.
- Redis-backed status and progress tracking.

### How to use (UI)

1. Log in as an **admin**.
2. Open **Settings** from the sidebar.
3. Click on the **Data Enrichment** card.
4. Use the interface to:
   - Start a new synchronization.
   - Monitor ingestion progress and details (start time, duration, status).
   - Cancel an ongoing sync.
   - Clear completed sync status.

### CLI usage

You can also run the NVD sync script manually:

```bash
python sync_nvd.py
```

### API endpoints

All endpoints are restricted to admins:

- `POST /api/v1/nvd-sync/start` – Start synchronization.
- `GET /api/v1/nvd-sync/status` – Get current status and CVE count.
- `POST /api/v1/nvd-sync/cancel` – Cancel current synchronization.
- `DELETE /api/v1/nvd-sync/status` – Clear sync status from Redis.

### Technical notes

- Progress is stored in Redis under keys like `nvd_sync:status` and `nvd_sync:cve_count`.
- Rate limiting is respected (e.g. 6 seconds between NVD API requests).
- Rejected / invalid CVEs are filtered.
- Data is ingested in batches for performance.

---

## Screenshot

### Login page
<img src="/frontend/public/screenshot/login.png" width="800" alt="login">

### Home Dashboard
<img src="/frontend/public/screenshot/dashboard.png" width="800" alt="dashboard">

### Vulnerabilities
<img src="/frontend/public/screenshot/vulnerabilities.png" width="800" alt="vulnerabilities">
<img src="/frontend/public/screenshot/vulnerabilities1.png" width="800" alt="vulnerabilities1">
<img src="/frontend/public/screenshot/vulnerabilities2.png" width="800" alt="vulnerabilities2">

### Workflow
<img src="/frontend/public/screenshot/workflow1.png" width="800" alt="workflow1">
<img src="/frontend/public/screenshot/workflow2.png" width="800" alt="workflow2">
<img src="/frontend/public/screenshot/workflow3.png" width="800" alt="workflow3">

### Directory
<img src="/frontend/public/screenshot/directory.png" width="800" alt="directory">


### Connectors
<img src="/frontend/public/screenshot/connectors.png" width="800" alt="Architecture">

### Host
<img src="/frontend/public/screenshot/hosts.png" width="800" alt="hosts">
<img src="/frontend/public/screenshot/hosts1.png" width="800" alt="hosts1">

### Inventory
<img src="/frontend/public/screenshot/inventory.png" width="800" alt="inventory">
---

## License

This project is provided as-is for security monitoring and research purposes. See the project license file (if present) for precise terms.

<!-- MARKDOWN LINKS & IMAGES -->
[issues-shield]: https://img.shields.io/github/issues/Krook9d/SafeMatrix.svg?style=for-the-badge
[issues-url]: https://github.com/Krook9d/SafeMatrix/issues
[license-shield]: https://img.shields.io/github/license/Krook9d/SafeMatrix.svg?style=for-the-badge
[license-url]: https://github.com/Krook9d/SafeMatrix/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/martin-cayrol-47669a1a2/
[forks-shield]: https://img.shields.io/github/forks/Krook9d/SafeMatrix.svg?style=for-the-badge
[forks-url]: https://github.com/Krook9d/SafeMatrix/network/members
[stars-shield]: https://img.shields.io/github/stars/Krook9d/SafeMatrix.svg?style=for-the-badge
[stars-url]: https://github.com/Krook9d/SafeMatrix/stargazers
