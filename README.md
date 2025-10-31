# SafeMatrix


### Setup & Launch

To run the application, database services (PostgreSQL, OpenSearch) must first be launched via Docker. Then, the Python backend can be started.

#### 1. Launch Services (Docker) 
From the **project root** (the folder containing `docker-compose.yml`), run:
```bash
docker compose up --build -d
```
This will start PostgreSQL and OpenSearch in the background.

To stop them properly, use:
```bash
docker-compose down
```

#### 2. Setup the env variable & Launch Backend (Python) 
Once Docker services are started, follow these steps from the `backend/` folder root.

**a. Create a virtual environment**
```bash
python3 -m venv venv
```

**b. Activate the virtual environment**
- On Windows (PowerShell):
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- On macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

**c. Install dependencies**
Make sure the virtual environment is activated, then run:
```bash
pip install -r requirements.txt
```
**d. Setup environment variables**

1. Copy the environment template:
   ```bash
   cp backend/.env.exemple backend/.env
   ```

2. Edit the `backend/.env` file with your configuration:
   - Set your NVD API token: `NVD_TOKEN_API=your-nvd-token`
   - Set your Gmail credentials:
     - Replace `your-email@gmail.com` with your Gmail address
     - Replace `your-app-password-here` with your Gmail App Password
     - Generate an App Password from: https://myaccount.google.com/security

**d.1. (optionnal) Configure Gmail for email notifications**

After setting up your `backend/.env` file, you need to update the database configuration:

1. Edit `update_gmail_config.sql` and replace:
   - `YOUR_GMAIL_ADDRESS` with your Gmail address
   - `YOUR_GMAIL_APP_PASSWORD` with your Gmail App Password

2. Apply the configuration to the database:
   ```bash
   cmd /c "docker exec -e PGPASSWORD=password -i postgres_db psql -v ON_ERROR_STOP=1 -U user -d main_db < update_gmail_config.sql"
   ```

**e. Launch the development server**
This command starts the server, which will automatically reload on every code change.
```bash
uvicorn backend.main:app --reload
```
The API will then be accessible at `http://127.0.0.1:8000`.

#### 3. reLaunch Frontend (React)

```bash
docker-compose restart frontend
```
The frontend will be accessible at `http://localhost:5173`.

**c. Build for production**
```bash
npm run build
```

---

### Frontend Development

The frontend is built with:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Material-UI (MUI)** for modern UI components
- **React Router** for navigation
- **Axios** for API communication

#### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

---

## User Management

SafeMatrix enforces admin-only provisioning by default. End-users cannot self-register via the UI.

### Roles

- **admin**: Full access. Can manage users (create, update roles, delete), manage connectors, workflows, etc.
- **analyst**: Read/operate within the platform. No user administration.
- **viewer**: Read-only access to dashboards and data.

### Provisioning Model

- By default, public signup is disabled. Only admins can create users.
- Bootstrap an initial admin via environment variables at backend startup.

Environment variables in `backend/.env`:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
ALLOW_SELF_SIGNUP=false
```

- If `ALLOW_SELF_SIGNUP=true`, the backend permits self-signup but forces every self-created account to role `viewer` regardless of input.

### Frontend Access (Admin Only)

- Log in as an admin and open the admin users page:
  - Navigation item: `Users` (visible only for admin)
  - Route: `/admin/users`
- From this page admins can:
  - Create a user (username, password, role)
  - Update a user role
  - Delete a user

### Authentication

- JWT bearer tokens stored in `localStorage` key `access_token`.
- `authAPI.getCurrentUser()` resolves the current user and role to drive route guards and navigation.

### API Endpoints (Backend)

All user administration endpoints are admin-only (enforced via `require_roles("admin")`).

- List users:
  - `GET /api/v1/users/?skip=0&limit=100`
- Create user:
  - `POST /api/v1/users/`
  - Body: `{ "username": "alice", "password": "Secret123!", "role": "analyst" }`
- Update role:
  - `PUT /api/v1/users/{username}/role`
  - Body: `{ "role": "viewer" }`
- Delete user:
  - `DELETE /api/v1/users/{username}`

Example cURL (replace token and host):

```bash
TOKEN="<ADMIN_JWT_TOKEN>"

curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/v1/users/

curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"SafePass!2025","role":"viewer"}' \
  http://127.0.0.1:8000/api/v1/users/

curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"analyst"}' \
  http://127.0.0.1:8000/api/v1/users/bob/role

curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/api/v1/users/bob
```

### Notes

- Frontend login page intentionally has no signup UI when `ALLOW_SELF_SIGNUP=false`.
- If the Users nav item is not visible after logging in as admin, ensure the token is valid and `/api/v1/users/me/` returns `role: "admin"`.

---

## Data Enrichment (NVD Synchronization)

SafeMatrix includes an automated CVE data enrichment system that synchronizes vulnerability data from the National Vulnerability Database (NVD).

### Features

- **Automated Synchronization**: Launch CVE synchronization from the admin interface
- **Real-time Progress Tracking**: View live updates of CVE ingestion count during synchronization
- **Background Processing**: Synchronization runs in the background without blocking the application
- **Redis-based Status Management**: Sync status and progress stored in Redis for real-time updates

### Accessing Data Enrichment

1. Log in as an **admin** user
2. Navigate to **Settings** from the sidebar
3. Click on the **Data Enrichment** card
4. Use the interface to:
   - Start a new synchronization
   - Monitor real-time progress (CVE count updates every 2 seconds)
   - View synchronization details (start time, duration, status)
   - Cancel ongoing synchronization
   - Clear completed synchronization status

### Manual Script Execution

You can still run the synchronization script manually from the command line:

```bash
python sync_nvd.py
```

### API Endpoints

All data enrichment endpoints are admin-only:

- **Start Sync**: `POST /api/v1/nvd-sync/start`
  - Initiates NVD synchronization in the background
  
- **Get Status**: `GET /api/v1/nvd-sync/status`
  - Returns current sync status and CVE count
  
- **Cancel Sync**: `POST /api/v1/nvd-sync/cancel`
  - Cancels the current synchronization
  
- **Clear Status**: `DELETE /api/v1/nvd-sync/status`
  - Clears the synchronization status from Redis

### Technical Details

- Synchronization progress is tracked in Redis with key `nvd_sync:status`
- CVE count is stored in Redis with key `nvd_sync:cve_count`
- The sync process respects NVD API rate limits (6 seconds between requests)
- Rejected CVEs are automatically filtered out
- Data is inserted in batches of 200 for optimal performance

### Prerequisites

- Redis must be running (included in `docker-compose.yml`)
- Valid NVD API key configured in `backend/.env` (optional but recommended for better rate limits)
- OpenSearch must be accessible for data storage