from sqlalchemy.orm import Session

from ..core.security import get_password_hash
from ..models import user as models_user
from ..schemas import user as schemas_user

def get_user_by_username(db: Session, username: str):
    return db.query(models_user.User).filter(models_user.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models_user.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas_user.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models_user.User(
        username=user.username,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_role(db: Session, username: str, role: schemas_user.UserBase.Role):
    db_user = get_user_by_username(db, username)
    if not db_user:
        return None
    db_user.role = role
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, username: str) -> bool:
    db_user = get_user_by_username(db, username)
    if not db_user:
        return False
    db.delete(db_user)
    db.commit()
    return True