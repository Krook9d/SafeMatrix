# SafeMatrix

# FastAPI Backend Architecture (SafeMatrix)

This document explains the folder and file structure of this backend project. The goal is to clearly separate responsibilities (separation of concerns) to make the code easier to maintain and evolve.

---

### `main.py`

This is the main **entry point** of the application.
- It initializes the FastAPI application.
- It launches database table creation on startup.
- It includes API routers defined in the `/api` folder.

---

### `/core` Folder

Contains the "central" logic and configuration of the application.
- **`config.py`**: Manages environment variables and configuration parameters (e.g., database URL, secret keys) using Pydantic.
- **`database.py`**: Establishes connection to the PostgreSQL database (the SQLAlchemy "engine") and provides database sessions to the application.
- **`opensearch_client.py`**: Manages connection to the OpenSearch cluster and contains logic to create indexes (`hosts`, `inventories`) on application startup.
- **`security.py`**: Contains security-related functions, such as password hashing and JWT token creation/verification.
- **`dependencies.py`**: Defines reusable dependencies across the application, such as `get_db` to get a database session, `get_current_user` for route protection, and `get_opensearch_client` for OpenSearch access.

---

### `/models` Folder

Defines the structure of **database tables**.
- **`user.py`**: Contains the `User` class, which is the SQLAlchemy model corresponding to the `users` table in PostgreSQL. It defines the columns (`id`, `username`, `hashed_password`, etc.).

---

### `/schemas` Folder

Defines the **shape of data** that the API receives and sends, using Pydantic models for validation.
- **`user.py`**: Contains schemas for the user (`UserCreate`, `User`).
- **`host.py`**: Contains schemas for machines (`HostCreate`, `Host`, etc.), defining the expected structure for creating or returning a machine.

---

### `/crud` Folder

Stands for **C**reate, **R**ead, **U**pdate, **D**elete. Contains logic that directly interacts with databases (PostgreSQL or OpenSearch).
- **`user.py`**: Contains functions to manipulate users in PostgreSQL (`get_user_by_username`, `create_user`).
- **`host.py`**: Contains functions to manipulate machines in OpenSearch (`create_host`, `get_host`).

---

### `/api` Folder

Defines the **routes (endpoints)** of the API.
- **`/v1`**: A sub-folder for version 1 of our API.
  - **`users.py`**: Defines routes for users (`POST /users/`, `GET /users/me`).
  - **`login.py`**: Defines authentication route (`POST /login/access-token`).
  - **`health.py`**: Contains routes to check service status, such as OpenSearch.
  - **`hosts.py`**: Defines routes for machines (`POST /hosts/`, `GET /hosts/{host_id}`).

---

### Setup & Launch

To run the application, database services (PostgreSQL, OpenSearch) must first be launched via Docker. Then, the Python backend can be started.

#### 1. Launch Services (Docker)
From the **project root** (the folder containing `docker-compose.yml`), run:
```bash
docker-compose up -d
```
This will start PostgreSQL and OpenSearch in the background.

To stop them properly, use:
```bash
docker-compose down
```

#### 2. Launch Backend (Python)
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

**d. Launch the development server**
This command starts the server, which will automatically reload on every code change.
```bash
uvicorn backend.main:app --reload
```
The API will then be accessible at `http://127.0.0.1:8000`.

#### 3. Launch Frontend (React)
Navigate to the `frontend/` folder and follow these steps:

**a. Install dependencies**
```bash
npm install
```

**b. Launch the development server**
```bash
npm run dev
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
