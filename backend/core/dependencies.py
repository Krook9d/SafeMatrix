from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.opensearch_client import get_opensearch_client as os_client_dep
import crud.user as crud
import schemas.user as schemas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login/access-token")

# This is a new dependency that we can use in our path operations
def get_opensearch_client():
    return os_client_dep()

class TokenData(BaseModel):
    username: str | None = None

async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> schemas.User:
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

    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user 