from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...crud import user as crud_user
from ...schemas import user as schemas_user
from ...core.database import get_db
from ...core.dependencies import get_current_user, require_roles
from ...core.config import settings

router = APIRouter()

@router.post("/users/", response_model=schemas_user.User, status_code=201)
def create_user(
    user: schemas_user.UserCreate,
    db: Session = Depends(get_db),
    current_user: schemas_user.User | None = Depends(get_current_user) if settings.ALLOW_SELF_SIGNUP else Depends(require_roles("admin")),
):
    db_user = crud_user.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    # If self-signup is allowed, force role to viewer regardless of input
    if settings.ALLOW_SELF_SIGNUP:
        user.role = schemas_user.UserBase.Role.viewer
    return crud_user.create_user(db=db, user=user)

@router.get("/users/", response_model=list[schemas_user.User])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: schemas_user.User = Depends(require_roles("admin")),
):
    return crud_user.get_users(db, skip=skip, limit=limit)

@router.get("/users/{username}", response_model=schemas_user.User)
def read_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user),
):
    db_user = crud_user.get_user_by_username(db, username=username)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.get("/users/me/", response_model=schemas_user.User)
def read_users_me(current_user: schemas_user.User = Depends(get_current_user)):
    """
    Get current user.
    """
    return current_user

@router.put("/users/{username}/role", response_model=schemas_user.User)
def update_user_role(
    username: str,
    payload: schemas_user.UserUpdateRole,
    db: Session = Depends(get_db),
    _: schemas_user.User = Depends(require_roles("admin")),
):
    updated = crud_user.update_user_role(db, username=username, role=payload.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated

@router.delete("/users/{username}", status_code=204)
def delete_user(
    username: str,
    db: Session = Depends(get_db),
    _: schemas_user.User = Depends(require_roles("admin")),
):
    ok = crud_user.delete_user(db, username=username)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return None