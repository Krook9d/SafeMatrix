from typing import List, Optional
from sqlalchemy.orm import Session

from backend.models.custom_db import Team, TeamMember
from backend.schemas.custom_db import TeamCreate, TeamUpdate


def _upsert_members(db: Session, team: Team, members_payload: List[dict]):
    # Replace members set to keep logic simple and predictable
    db.query(TeamMember).filter(TeamMember.team_id == team.id).delete()
    for member in members_payload:
        db_member = TeamMember(
            team_id=team.id,
            email=member["email"],
            name=member.get("name"),
            role=member.get("role"),
            notes=member.get("notes"),
        )
        db.add(db_member)


def create_team(db: Session, team: TeamCreate, created_by: str) -> Team:
    db_team = Team(
        name=team.name,
        description=team.description,
        notes=team.notes,
        extra_data=team.extra_data,
        created_by=created_by,
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)

    if team.members:
        _upsert_members(db, db_team, [m.dict() for m in team.members])
        db.commit()
        db.refresh(db_team)
    return db_team


def list_teams(db: Session) -> List[Team]:
    return db.query(Team).order_by(Team.name).all()


def get_team(db: Session, team_id: int) -> Optional[Team]:
    return db.query(Team).filter(Team.id == team_id).first()


def update_team(db: Session, team_id: int, team_update: TeamUpdate, updated_by: str) -> Optional[Team]:
    team = get_team(db, team_id)
    if not team:
        return None

    data = team_update.dict(exclude_unset=True)
    for field, value in data.items():
        if field == "members":
            continue
        setattr(team, field, value)
    team.updated_by = updated_by
    db.commit()
    db.refresh(team)

    if "members" in data and data["members"] is not None:
        _upsert_members(db, team, [m.dict() for m in data["members"]])
        db.commit()
        db.refresh(team)

    return team


def delete_team(db: Session, team_id: int) -> bool:
    team = get_team(db, team_id)
    if not team:
        return False
    db.delete(team)
    db.commit()
    return True

