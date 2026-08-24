"""Disruption handling — the heart of the system.

Design principle: minimal disturbance. A replan only touches the interviews
that are actually invalidated by the disruption; every other interview on
that day is frozen (its room/panel/slot is treated as already-occupied
ground truth) and never moves. This is why a 2-hour delay for one company
does not cascade into reshuffling the whole day: only that company's own
now-conflicting interviews are re-placed, searching for the earliest slot
that still respects everyone else's existing bookings.

Each disruption function returns a diff: what moved (before/after), what
had to be cancelled (with a reason), and who needs to be told. Nothing is
ever silently dropped.
"""

from collections import defaultdict

from sqlalchemy.orm import Session

from app.config import slot_to_clock
from app.models import Company, Interview, InterviewStatus, Panel, Room, Shortlist, Student
from app.scheduler import _DayBoard, _diagnose_failure, _mark, _try_place, _units


def _snapshot(iv: Interview) -> dict:
    return {
        "day": iv.day,
        "start_slot": iv.start_slot,
        "clock": slot_to_clock(iv.start_slot) if iv.start_slot is not None else None,
        "room": iv.room.name if iv.room else None,
        "panel": iv.panel.label if iv.panel else None,
    }


def _build_day_board(db: Session, day: int, exclude_ids: set[int]) -> _DayBoard:
    room_ids = [r.id for r in db.query(Room).filter(Room.available.is_(True)).all()]
    board = _DayBoard(room_ids)

    frozen = (
        db.query(Interview)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .filter(Interview.day == day)
        .filter(~Interview.id.in_(exclude_ids) if exclude_ids else True)
        .all()
    )
    for iv in frozen:
        board.ensure_panel(iv.panel_id)
        board.ensure_student(iv.shortlist.student_id)
        num_units = _units(iv.duration_minutes)
        _mark(board.panel_free[iv.panel_id], iv.start_slot, num_units, False)
        _mark(board.student_free[iv.shortlist.student_id], iv.start_slot, num_units, False)
        _mark(board.room_free[iv.room_id], iv.start_slot, num_units, False)
    return board


def _reschedule(
    db: Session,
    board: _DayBoard,
    interviews: list[Interview],
    active_panel_ids_by_company: dict[int, list[int]],
    min_start_by_company: dict[int, int] | None = None,
    cancel_reason_if_impossible: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """Try to re-place each interview using the given board. Interviews are
    processed CGPA-descending across the whole batch (merit tie-break, same
    rule as the initial scheduler)."""

    moved, cancelled = [], []
    min_start_by_company = min_start_by_company or {}

    for iv in sorted(interviews, key=lambda x: x.shortlist.student.cgpa, reverse=True):
        before = _snapshot(iv)
        company_id = iv.shortlist.company_id
        panel_ids = active_panel_ids_by_company.get(company_id, [])
        student_id = iv.shortlist.student_id
        board.ensure_student(student_id)
        for pid in panel_ids:
            board.ensure_panel(pid)

        num_units = _units(iv.duration_minutes)
        min_start = min_start_by_company.get(company_id, 0)

        placement = _try_place(board, student_id, company_id, panel_ids, num_units, min_start) if panel_ids else None

        if placement:
            panel_id, room_id, start = placement
            iv.panel_id, iv.room_id, iv.start_slot = panel_id, room_id, start
            iv.status = InterviewStatus.SCHEDULED
            iv.unscheduled_reason = None
            after = _snapshot(iv)
            moved.append(
                {
                    "interview_id": iv.id,
                    "student": iv.shortlist.student.name,
                    "roll_no": iv.shortlist.student.roll_no,
                    "company": iv.shortlist.company.name,
                    "before": before,
                    "after": after,
                }
            )
        else:
            reason = (
                cancel_reason_if_impossible
                or (
                    _diagnose_failure(board, student_id, panel_ids, num_units, len(interviews), len(panel_ids), min_start)
                    if panel_ids
                    else "Company has no remaining active panels."
                )
            )
            iv.status = InterviewStatus.UNSCHEDULED
            iv.room_id = None
            iv.panel_id = None
            iv.day = None
            iv.start_slot = None
            iv.unscheduled_reason = reason
            cancelled.append(
                {
                    "interview_id": iv.id,
                    "student": iv.shortlist.student.name,
                    "roll_no": iv.shortlist.student.roll_no,
                    "company": iv.shortlist.company.name,
                    "before": before,
                    "reason": reason,
                }
            )
    return moved, cancelled


def _opportunistic_backfill(db: Session, board: _DayBoard, day: int) -> list[dict]:
    """After a repair pass, some rooms/panels for *other* companies on the
    same day may now sit idle in slots that used to be occupied (e.g. a
    cancelled interview's old room-time). Sweep the day's own waitlist —
    interviews that failed to schedule the first time round — and see if
    any now fit, most-protected company first, highest CGPA first."""

    candidates = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .join(Company, Shortlist.company_id == Company.id)
        .join(Student, Shortlist.student_id == Student.id)
        .filter(Interview.status == InterviewStatus.UNSCHEDULED)
        .filter(Company.scheduled_day == day)
        .filter(Student.withdrawn.is_(False))
        .all()
    )
    candidates.sort(key=lambda iv: (iv.shortlist.company.priority_rank, -iv.shortlist.student.cgpa))

    backfilled = []
    for iv in candidates:
        company = iv.shortlist.company
        active_panel_ids = [p.id for p in company.panels if p.active]
        if not active_panel_ids:
            continue
        for pid in active_panel_ids:
            board.ensure_panel(pid)
        student_id = iv.shortlist.student_id
        board.ensure_student(student_id)

        num_units = _units(iv.duration_minutes)
        placement = _try_place(board, student_id, company.id, active_panel_ids, num_units)
        if placement:
            panel_id, room_id, start = placement
            iv.panel_id, iv.room_id, iv.day, iv.start_slot = panel_id, room_id, day, start
            iv.status = InterviewStatus.SCHEDULED
            iv.unscheduled_reason = None
            backfilled.append(
                {
                    "interview_id": iv.id,
                    "student": iv.shortlist.student.name,
                    "roll_no": iv.shortlist.student.roll_no,
                    "company": company.name,
                    "after": _snapshot(iv),
                }
            )
    return backfilled


def _notify(moved: list[dict], cancelled: list[dict], extra: list[dict] | None = None) -> dict:
    students: dict[str, list[str]] = defaultdict(list)
    companies = set()
    for row in moved:
        students[row["roll_no"]].append(f"{row['student']} — time/room/panel changed for {row['company']}")
        companies.add(row["company"])
    for row in cancelled:
        students[row["roll_no"]].append(
            f"{row['student']} — interview with {row['company']} cancelled: {row['reason']}"
        )
        companies.add(row["company"])
    for row in extra or []:
        students[row["roll_no"]].append(f"{row['student']} — newly scheduled with {row['company']} (backfilled slot)")
        companies.add(row["company"])
    return {
        "students": sorted(msg for messages in students.values() for msg in messages),
        "companies": sorted(companies),
    }


def replan_company_delay(db: Session, company_id: int, delay_hours: float) -> dict:
    company = db.get(Company, company_id)
    delay_minutes = int(delay_hours * 60)
    delay_slot = -(-delay_minutes // 15)  # ceil div by SLOT_GRANULARITY_MINUTES
    company.arrival_delay_minutes = delay_minutes

    affected = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .filter(Shortlist.company_id == company_id)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .filter(Interview.day == company.scheduled_day)
        .filter(Interview.start_slot < delay_slot)
        .all()
    )

    if not affected:
        db.commit()
        return {
            "disruption": f"{company.name} arriving {delay_hours}h late",
            "moved": [],
            "cancelled": [],
            "notify": {"students": [], "companies": []},
            "note": "No scheduled interviews fell inside the delay window — nothing to replan.",
        }

    exclude_ids = {iv.id for iv in affected}
    board = _build_day_board(db, company.scheduled_day, exclude_ids)
    active_panel_ids = [p.id for p in company.panels if p.active]

    moved, cancelled = _reschedule(
        db,
        board,
        affected,
        active_panel_ids_by_company={company_id: active_panel_ids},
        min_start_by_company={company_id: delay_slot},
    )
    backfilled = _opportunistic_backfill(db, board, company.scheduled_day)
    db.commit()

    return {
        "disruption": f"{company.name} arriving {delay_hours}h late on day {company.scheduled_day}",
        "moved": moved,
        "cancelled": cancelled,
        "backfilled": backfilled,
        "notify": _notify(moved, cancelled, backfilled),
    }


def replan_panel_dropout(db: Session, panel_id: int) -> dict:
    panel = db.get(Panel, panel_id)
    company = panel.company
    panel.active = False

    affected = (
        db.query(Interview)
        .filter(Interview.panel_id == panel_id)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .all()
    )

    if not affected:
        db.commit()
        return {
            "disruption": f"Panel {panel.label} ({company.name}) dropped out",
            "moved": [],
            "cancelled": [],
            "notify": {"students": [], "companies": []},
            "note": "That panel had no scheduled interviews — nothing to replan.",
        }

    day = affected[0].day
    exclude_ids = {iv.id for iv in affected}
    board = _build_day_board(db, day, exclude_ids)
    remaining_panel_ids = [p.id for p in company.panels if p.active]

    moved, cancelled = _reschedule(
        db,
        board,
        affected,
        active_panel_ids_by_company={company.id: remaining_panel_ids},
    )
    backfilled = _opportunistic_backfill(db, board, day)
    db.commit()

    return {
        "disruption": f"Panel {panel.label} ({company.name}) dropped out",
        "moved": moved,
        "cancelled": cancelled,
        "backfilled": backfilled,
        "notify": _notify(moved, cancelled, backfilled),
    }


def replan_room_unavailable(db: Session, room_id: int) -> dict:
    room = db.get(Room, room_id)
    room.available = False

    affected = (
        db.query(Interview)
        .filter(Interview.room_id == room_id)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .all()
    )

    if not affected:
        db.commit()
        return {
            "disruption": f"{room.name} became unavailable",
            "moved": [],
            "cancelled": [],
            "notify": {"students": [], "companies": []},
            "note": "That room had no scheduled interviews — nothing to replan.",
        }

    by_day: dict[int, list[Interview]] = {}
    for iv in affected:
        by_day.setdefault(iv.day, []).append(iv)

    all_moved, all_cancelled, all_backfilled = [], [], []
    for day, day_interviews in by_day.items():
        exclude_ids = {iv.id for iv in day_interviews}
        board = _build_day_board(db, day, exclude_ids)
        panel_map = {
            iv.shortlist.company_id: [p.id for p in iv.shortlist.company.panels if p.active]
            for iv in day_interviews
        }
        moved, cancelled = _reschedule(db, board, day_interviews, active_panel_ids_by_company=panel_map)
        all_moved += moved
        all_cancelled += cancelled
        all_backfilled += _opportunistic_backfill(db, board, day)
    db.commit()

    return {
        "disruption": f"{room.name} became unavailable",
        "moved": all_moved,
        "cancelled": all_cancelled,
        "backfilled": all_backfilled,
        "notify": _notify(all_moved, all_cancelled, all_backfilled),
    }


def replan_student_withdrawal(db: Session, student_id: int) -> dict:
    student = db.get(Student, student_id)
    student.withdrawn = True

    live = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .filter(Shortlist.student_id == student_id)
        .filter(Interview.status.in_([InterviewStatus.SCHEDULED, InterviewStatus.PENDING]))
        .all()
    )

    cancelled = []
    freed_days: set[int] = set()
    for iv in live:
        before = _snapshot(iv)
        was_scheduled = iv.status == InterviewStatus.SCHEDULED
        day = iv.day
        iv.status = InterviewStatus.CANCELLED
        iv.unscheduled_reason = "Student withdrew (accepted another offer)."
        cancelled.append(
            {
                "interview_id": iv.id,
                "student": student.name,
                "roll_no": student.roll_no,
                "company": iv.shortlist.company.name,
                "before": before,
                "reason": iv.unscheduled_reason,
            }
        )
        if was_scheduled:
            freed_days.add(day)
        iv.room_id = None
        iv.panel_id = None
        iv.day = None
        iv.start_slot = None
    db.flush()

    # A withdrawal only ever frees capacity (it never removes any); sweep
    # each affected day's waitlist for anyone who now fits.
    backfilled = []
    for day in freed_days:
        board = _build_day_board(db, day, exclude_ids=set())
        backfilled += _opportunistic_backfill(db, board, day)

    db.commit()

    return {
        "disruption": f"{student.name} ({student.roll_no}) withdrew",
        "cancelled": cancelled,
        "backfilled": backfilled,
        "notify": _notify([], cancelled, backfilled),
    }
