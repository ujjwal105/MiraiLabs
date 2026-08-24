from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.replanner import (
    replan_company_delay,
    replan_panel_dropout,
    replan_room_unavailable,
    replan_student_withdrawal,
)
from app.schemas import (
    CompanyDelayRequest,
    PanelDropoutRequest,
    RoomUnavailableRequest,
    StudentWithdrawalRequest,
)

router = APIRouter(prefix="/api/disrupt", tags=["disruptions"])


@router.post("/company-delay")
def company_delay(payload: CompanyDelayRequest, db: Session = Depends(get_db)):
    return replan_company_delay(db, payload.company_id, payload.delay_hours)


@router.post("/panel-dropout")
def panel_dropout(payload: PanelDropoutRequest, db: Session = Depends(get_db)):
    return replan_panel_dropout(db, payload.panel_id)


@router.post("/student-withdrawal")
def student_withdrawal(payload: StudentWithdrawalRequest, db: Session = Depends(get_db)):
    return replan_student_withdrawal(db, payload.student_id)


@router.post("/room-unavailable")
def room_unavailable(payload: RoomUnavailableRequest, db: Session = Depends(get_db)):
    return replan_room_unavailable(db, payload.room_id)
