from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import engine
from .core.opensearch_client import create_indexes
from .models import user
from .models import workflow
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

user.Base.metadata.create_all(bind=engine)
workflow.Base.metadata.create_all(bind=engine)
create_indexes()

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
        "http://127.0.0.1:3000"
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

@app.get("/")
def read_root():
    """
    Root endpoint that returns a welcome message.
    """
    return {"message": "Welcome to the SafeMatrix API!"} 