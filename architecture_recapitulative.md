# 🛠️ Architecture Overview

## Project Summary

SafeMatrix is a centralized platform for collecting, analyzing, and visualizing software inventory and vulnerabilities on Windows, Linux, and macOS endpoints via Go agents. Vulnerabilities are automatically enriched from external public sources (AlienVault, etc.). FastAPI backend (Python), secure storage (OpenSearch, PostgreSQL), React dashboard, strong authentication.

## 1. Overview

```
[Go Agent]
   |  (Push JSON via HTTPS)
   v
[Python FastAPI API]  <---  [React Dashboard]
   |                       (fetch via JWT token)
   +--> [PostgreSQL] (users/auth)
   |
   +--> [OpenSearch] (hosts, inventory, logs)
```

---

## 2. Agent Endpoints

- Coded in **Go**, packaged for Windows/Linux/macOS
- Function as background service/daemon (invisible)
- Collect list of installed software + versions every 5 minutes
- Push data via **HTTPS/JSON** to the backend API

---

## 3. Main Backend (FastAPI)

- Receives inventories from agents
- Queries public APIs (AlienVault, etc.) to enrich software/versions with known vulnerabilities
- Stores enriched data in OpenSearch
- Authenticates users via **PostgreSQL** (username, password hash)
- Manages sessions with **JWT**
- Exposes REST API for:
  - Receiving inventories from agents
  - Allowing frontend (dashboard) to display hosts, inventories, vulnerabilities, etc.
  - Authenticating users

---

## 4. Storage

- **PostgreSQL**:
  - `users` table (username, hash, role, created_at…)
- **OpenSearch**:
  - `hosts` index: 1 doc/host (id, name, ip, os…)
  - `inventories` index: software inventory, version, date, **vulns**
    - e.g., `vulns`: [ {cve_id, description, score, url…}, … ]
  - Logs/alerts index if needed

---

## 5. Frontend (React)

- Authentication via API (login/password → JWT token)
- Ergonomic, modern dashboard, just a few pages:
  - Home page with KPIs (Summary charts (vulnerability distribution, hot hosts, etc.), latest vulnerabilities by date, etc.)
  - List of hosts + inventory/software details per host
  - Visualization of vulnerabilities associated with each software/host
  - Filters/search (full-text via API/backend)
- Recommended UI Kit: **Material-UI**

---

## 6. Deployment

- **Docker Compose** to orchestrate everything:
  - FastAPI backend container
  - PostgreSQL container
  - OpenSearch container
  - (Optional) OpenSearch Dashboard container
  - React frontend container (served via nginx or Vite)
- Go agents: installed directly on endpoints to monitor (outside Compose)

---

## 7. Security

- Passwords hashed with **bcrypt** in PostgreSQL
- OpenSearch access restricted to backend only
- All traffic over **HTTPS**
- No passwords or sensitive info in OpenSearch

---

## 8. Scalability / Roadmap

- Simple single-tenant MVP, scalable to multi-tenant by adding a column/key on indexed tables
- Possibility to add asynchronous worker/celery for batch processing if needed later
- AI/LLM addition possible later (separate module)

---

## 9. User Flow

1. **Admin/analyst** logs into the dashboard (React)
2. Frontend queries the backend API (FastAPI), with JWT
3. API reads users/auth from PostgreSQL, inventories/hosts from OpenSearch
4. **Go agents** push inventories regularly
5. New software/vulnerabilities appear in near real-time in the dashboard

---

## 10. ASCII Diagram

```
      [Endpoints/Users]
            |
        [Go Agent]
            |
         (Push HTTPS/JSON)
            |
       [FastAPI Backend]---[PostgreSQL: users/auth]
            |
       [OpenSearch: data]
            |
       [React Dashboard]
```

---

## Vulnerability Database 

### NVD API 2.0 - Main Source

✅ Advantages

100% free - No cost
Official US Government database
Comprehensive coverage - Over 300,000 CVEs
Enriched data - CVSS, CWE, CPE, etc.

⚠️ Critical limitations

With API key: 50 req/30s (~1.67 req/sec)
Current issues: Slowdowns and backlog since 2024

🔗 Essential links

API: https://services.nvd.nist.gov/rest/json/cves/2.0
API Key: https://nvd.nist.gov/developers/request-an-api-key
Documentation: https://nvd.nist.gov/developers/vulnerabilities

### CISA KEV - Critical Complement

✅ Advantages
Actively exploited vulnerabilities
Simple JSON feed
Priority data for security

⚠️ Limitations

Rate limits not specified but applied
Limited coverage to exploited vulnerabilities

🔗 Links

Official feed: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
GitHub mirror: https://raw.githubusercontent.com/BenjiTrapp/cisa-known-vuln-scraper/main/cisa-kev.json
Catalog: https://www.cisa.gov/known-exploited-vulnerabilities-catalog

### FediSec CVE Feed - Enrichment

✅ Advantages

EPSS scores included
Additional context
Permissive GitHub limits

🔗 Link

Feed: https://raw.githubusercontent.com/fedisecfeeds/fedisecfeeds.github.io/main/fedi_cve_feed.json

---

