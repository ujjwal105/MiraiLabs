from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Company, Interview, InterviewStatus, Panel, Room, Shortlist, Student
from app.serializers import company_to_dict, interview_to_dict, room_to_dict, student_to_dict

router = APIRouter(prefix="/api", tags=["query"])


@router.get("/companies")
def list_companies(db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.priority_rank).all()
    scheduled_counts = dict(
        db.query(Shortlist.company_id, func.count(Interview.id))
        .join(Interview, Interview.shortlist_id == Shortlist.id)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .group_by(Shortlist.company_id)
        .all()
    )
    totals = dict(db.query(Shortlist.company_id, func.count(Shortlist.id)).group_by(Shortlist.company_id).all())
    return [
        company_to_dict(
            c,
            scheduled=scheduled_counts.get(c.id, 0),
            unscheduled=totals.get(c.id, 0) - scheduled_counts.get(c.id, 0),
            total=totals.get(c.id, 0),
        )
        for c in companies
    ]


@router.get("/companies/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    interviews = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .filter(Shortlist.company_id == company_id)
        .all()
    )
    return {**company_to_dict(company), "interviews": [interview_to_dict(iv) for iv in interviews]}


@router.get("/panels")
def list_panels(company_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Panel)
    if company_id is not None:
        query = query.filter(Panel.company_id == company_id)
    return [{"id": p.id, "label": p.label, "company_id": p.company_id, "active": p.active} for p in query.all()]


@router.get("/rooms")
def list_rooms(db: Session = Depends(get_db)):
    return [room_to_dict(r) for r in db.query(Room).order_by(Room.name).all()]


@router.get("/students")
def list_students(q: str | None = Query(default=None), limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(Student)
    if q:
        query = query.filter(Student.name.ilike(f"%{q}%") | Student.roll_no.ilike(f"%{q}%"))
    return [student_to_dict(s) for s in query.order_by(Student.roll_no).limit(limit).all()]


@router.get("/students/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    interviews = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .filter(Shortlist.student_id == student_id)
        .all()
    )
    return {**student_to_dict(student), "interviews": [interview_to_dict(iv) for iv in interviews]}


@router.get("/interviews")
def list_interviews(
    day: int | None = None,
    status: str | None = None,
    company_id: int | None = None,
    room_id: int | None = None,
    panel_id: int | None = None,
    student_id: int | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    query = db.query(Interview).join(Shortlist, Interview.shortlist_id == Shortlist.id)
    if day is not None:
        query = query.filter(Interview.day == day)
    if status is not None:
        try:
            query = query.filter(Interview.status == InterviewStatus(status))
        except ValueError:
            raise HTTPException(400, f"Unknown status '{status}'")
    if company_id is not None:
        query = query.filter(Shortlist.company_id == company_id)
    if room_id is not None:
        query = query.filter(Interview.room_id == room_id)
    if panel_id is not None:
        query = query.filter(Interview.panel_id == panel_id)
    if student_id is not None:
        query = query.filter(Shortlist.student_id == student_id)

    interviews = query.order_by(Interview.day, Interview.start_slot).limit(limit).all()
    return [interview_to_dict(iv) for iv in interviews]


@router.get("/conflicts")
def list_conflicts(day: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Interview).filter(Interview.status == InterviewStatus.UNSCHEDULED)
    if day is not None:
        query = (
            query.join(Shortlist, Interview.shortlist_id == Shortlist.id)
            .join(Company, Shortlist.company_id == Company.id)
            .filter(Company.scheduled_day == day)
        )
    return [interview_to_dict(iv) for iv in query.all()]


@router.get("/state/summary")
def state_summary(db: Session = Depends(get_db)):
    by_status = dict(db.query(Interview.status, func.count(Interview.id)).group_by(Interview.status).all())
    by_day = dict(
        db.query(Interview.day, func.count(Interview.id))
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .group_by(Interview.day)
        .all()
    )
    return {
        "interviews_by_status": {k.value: v for k, v in by_status.items()},
        "scheduled_by_day": by_day,
        "total_students": db.query(func.count(Student.id)).scalar(),
        "total_companies": db.query(func.count(Company.id)).scalar(),
        "total_rooms": db.query(func.count(Room.id)).scalar(),
        "withdrawn_students": db.query(func.count(Student.id)).filter(Student.withdrawn.is_(True)).scalar(),
    }
