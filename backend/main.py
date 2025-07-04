from fastapi import FastAPI

from .core.database import engine
from .core.opensearch_client import create_indexes
from .models import user
from .api.v1 import users as users_router
from .api.v1 import login as login_router
from .api.v1 import health as health_router
from .api.v1 import hosts as hosts_router
from .api.v1 import inventories as inventories_router

user.Base.metadata.create_all(bind=engine)
create_indexes()

app = FastAPI(
    title="SafeMatrix API",
    description="API for inventory and vulnerability management.",
    version="0.1.0",
)

app.include_router(users_router.router, prefix="/api/v1", tags=["users"])
app.include_router(login_router.router, prefix="/api/v1", tags=["login"])
app.include_router(health_router.router, prefix="/api/v1")
app.include_router(hosts_router.router, prefix="/api/v1", tags=["hosts"])
app.include_router(inventories_router.router, prefix="/api/v1", tags=["inventories"])

@app.get("/")
def read_root():
    """
    Root endpoint that returns a welcome message.
    """
    return {"message": "Welcome to the SafeMatrix API!"} 