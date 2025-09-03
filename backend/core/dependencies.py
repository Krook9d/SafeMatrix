from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .opensearch_client import get_opensearch_client as os_client_dep
from ..crud import user as crud_user
from ..schemas import user as schemas_user

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login/access-token")
# Optional bearer (no auto error) to support public endpoints when allowed
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/login/access-token", auto_error=False)

# This is a new dependency that we can use in our path operations
def get_opensearch_client():
    return os_client_dep()

class TokenData(BaseModel):
    username: str | None = None

async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> schemas_user.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    if token_data.username is None:
        raise credentials_exception

    user = crud_user.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

def require_roles(*allowed_roles: str):
    """Dependency factory to enforce that current_user has one of allowed roles.

    Usage: Depends(require_roles("admin", "analyst"))
    """
    async def _checker(current_user: schemas_user.User = Depends(get_current_user)) -> schemas_user.User:
        if not allowed_roles:
            return current_user
        if str(current_user.role) not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _checker

# Optional current user dependency: returns None when no token
async def optional_current_user(
    token: str | None = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)
) -> schemas_user.User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    user = crud_user.get_user_by_username(db, username=username)
    return user

def admin_or_open_signup():
    """Allows unauthenticated access when ALLOW_SELF_SIGNUP is true; otherwise requires admin."""
    async def _dep(current_user: schemas_user.User | None = Depends(optional_current_user)) -> schemas_user.User | None:
        if settings.ALLOW_SELF_SIGNUP and current_user is None:
            return None
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        if str(current_user.role) != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
        return current_user
    return _dep