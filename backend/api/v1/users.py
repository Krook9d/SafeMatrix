from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...crud import user as crud_user
from ...schemas import user as schemas_user
from ...core.database import get_db
from ...core.dependencies import get_current_user

router = APIRouter()

@router.post("/users/", response_model=schemas_user.User, status_code=201)
def create_user(user: schemas_user.UserCreate, db: Session = Depends(get_db)):
    db_user = crud_user.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud_user.create_user(db=db, user=user)

@router.get("/users/{username}", response_model=schemas_user.User)
def read_user(username: str, db: Session = Depends(get_db)):
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