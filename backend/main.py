from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from datetime import datetime

from .core.database import engine, SessionLocal
from .core.opensearch_client import create_indexes
from .models import user
from .models import workflow
from .models import audit_log
from .api.v1 import users as users_router
from .api.v1 import login as login_router
from .api.v1 import health as health_router
from .api.v1 import hosts as hosts_router
from .api.v1 import inventories as inventories_router
from .api.v1 import vulnerabilities as vulnerabilities_router
from .api.v1 import agents as agents_router
from .api.v1 import dashboard as dashboard_router
from .api.v1 import opensearch as opensearch_router
from .api.v1 import workflows as workflows_router
from .api.v1 import connectors as connectors_router
from .api.v1 import audit_logs as audit_logs_router
from .api.v1 import alerts as alerts_router
from .core.config import settings
from .crud import user as crud_user
from .schemas import user as schemas_user

# Configure logging
LOG_DIR = "logs"
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

log_filename = os.path.join(os.getcwd(), LOG_DIR, f"backend_{datetime.now().strftime('%Y-%m-%d')}.log")

# Create logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create formatters
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Create file handler
file_handler = logging.FileHandler(log_filename)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# Create console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Test logging
main_logger = logging.getLogger(__name__)
main_logger.info("Backend starting up - logging configuration initialized")
main_logger.info(f"Log file path: {log_filename}")

# Also test with root logger
logging.info("Root logger test - this should appear in file")
print(f"Log file will be written to: {log_filename}")

user.Base.metadata.create_all(bind=engine)
workflow.Base.metadata.create_all(bind=engine)
audit_log.Base.metadata.create_all(bind=engine)
create_indexes()

# Bootstrap admin user if configured
def _bootstrap_admin_user():
    if not settings.ADMIN_USERNAME or not settings.ADMIN_PASSWORD:
        return
    db = SessionLocal()
    try:
        existing = crud_user.get_user_by_username(db, settings.ADMIN_USERNAME)
        if not existing:
            admin_user = schemas_user.UserCreate(
                username=settings.ADMIN_USERNAME,
                password=settings.ADMIN_PASSWORD,
                role=schemas_user.UserBase.Role.admin,
            )
            crud_user.create_user(db, admin_user)
            print("Bootstrap: admin user created.")
        else:
            # Optionally we could ensure role is admin, but avoid mutating silently
            pass
    finally:
        db.close()

_bootstrap_admin_user()

app = FastAPI(
    title="SafeMatrix API",
    description="API for inventory and vulnerability management.",
    version="0.1.0",
)

# Add CORS middleware FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(users_router.router, prefix="/api/v1", tags=["users"])
app.include_router(login_router.router, prefix="/api/v1", tags=["login"])
app.include_router(health_router.router, prefix="/api/v1")
app.include_router(hosts_router.router, prefix="/api/v1", tags=["hosts"])
app.include_router(inventories_router.router, prefix="/api/v1", tags=["inventories"])
app.include_router(vulnerabilities_router.router, prefix="/api/v1/vulnerabilities", tags=["vulnerabilities"])
app.include_router(agents_router.router, prefix="/api/v1", tags=["agents"])
app.include_router(dashboard_router.router, prefix="/api/v1", tags=["dashboard"])
app.include_router(opensearch_router.router, prefix="/api/v1/opensearch", tags=["opensearch"])
app.include_router(workflows_router.router, prefix="/api/v1/workflows", tags=["workflows"])
app.include_router(connectors_router.router, prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(audit_logs_router.router, prefix="/api/v1", tags=["audit-logs"])
app.include_router(alerts_router.router, prefix="/api/v1", tags=["alerts"])

@app.get("/")
def read_root():
    """
    Root endpoint that returns a welcome message.
    """
    return {"message": "Welcome to the SafeMatrix API!"} 