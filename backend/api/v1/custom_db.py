from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.dependencies import get_db, get_current_user, require_roles
from backend.schemas import user as schemas_user
from backend.schemas.custom_db import Team, TeamCreate, TeamUpdate
from backend.crud import custom_db as crud_custom_db

router = APIRouter()


@router.get("/teams/", response_model=List[Team])
def list_teams(db: Session = Depends(get_db), current_user: schemas_user.User = Depends(get_current_user)):
    return crud_custom_db.list_teams(db)


@router.post("/teams/", response_model=Team)
def create_team(
    *,
    db: Session = Depends(get_db),
    team_in: TeamCreate,
    current_user: schemas_user.User = Depends(require_roles("admin", "analyst")),
):
    return crud_custom_db.create_team(db, team_in, created_by=current_user.username)


@router.get("/teams/{team_id}", response_model=Team)
def get_team(team_id: int, db: Session = Depends(get_db), current_user: schemas_user.User = Depends(get_current_user)):
    team = crud_custom_db.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.put("/teams/{team_id}", response_model=Team)
def update_team(
    team_id: int,
    *,
    db: Session = Depends(get_db),
    team_in: TeamUpdate,
    current_user: schemas_user.User = Depends(require_roles("admin", "analyst")),
):
    team = crud_custom_db.update_team(db, team_id, team_in, updated_by=current_user.username)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.delete("/teams/{team_id}")
def delete_team(
    team_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(require_roles("admin", "analyst")),
):
    success = crud_custom_db.delete_team(db, team_id)
    if not success:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"message": "Team deleted successfully"}

