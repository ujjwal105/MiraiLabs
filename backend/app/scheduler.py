"""Initial feasible-schedule builder.

Approach: day-by-day greedy earliest-fit list scheduling, not a full CSP
solver. This is a deliberate choice for a system a coordinator has to trust
and a candidate has to defend live: a greedy pass is transparent (you can
explain exactly why any one interview landed where it did) and fast enough
to rerun on demand, at the cost of not being provably optimal. A CP-SAT/ILP
formulation would very likely shave a few percent off the unscheduled count,
but "never fail silently" is satisfied by the diagnosis step below regardless
of which method placed the schedule.

Within a day, companies are processed in priority_rank order (most protected
first — see generator.py for the tier rationale), so when rooms run out it is
the least-protected companies whose interviews go unscheduled first. Within a
company, students are processed by CGPA descending as a tie-break: when a
company's own panels can't cover its full shortlist, higher-merit students
get first claim on the available slots.
"""

import math
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import NUM_DAYS, SLOT_GRANULARITY_MINUTES, SLOTS_PER_DAY
from app.models import Company, Interview, InterviewStatus, Panel, Room, Shortlist, Student


def _units(duration_minutes: int) -> int:
    return math.ceil(duration_minutes / SLOT_GRANULARITY_MINUTES)


def _free_run(slots: list[bool], start: int, num_units: int) -> bool:
    return all(slots[start : start + num_units])


def _mark(slots: list[bool], start: int, num_units: int, value: bool) -> None:
    for i in range(start, start + num_units):
        slots[i] = value


def build_missing_interviews(db: Session) -> int:
    """Create a PENDING Interview for every Shortlist that doesn't have one yet."""
    existing_shortlist_ids = {sid for (sid,) in db.execute(select(Interview.shortlist_id))}
    shortlists = db.execute(
        select(Shortlist.id, Company.interview_duration_minutes)
        .join(Company, Shortlist.company_id == Company.id)
    ).all()

    created = 0
    for shortlist_id, duration in shortlists:
        if shortlist_id in existing_shortlist_ids:
            continue
        db.add(
            Interview(
                shortlist_id=shortlist_id,
                duration_minutes=duration,
                status=InterviewStatus.PENDING,
            )
        )
        created += 1
    db.flush()
    return created


def reset_schedule(db: Session) -> None:
    db.query(Interview).update(
        {
            Interview.room_id: None,
            Interview.panel_id: None,
            Interview.day: None,
            Interview.start_slot: None,
            Interview.status: InterviewStatus.PENDING,
            Interview.unscheduled_reason: None,
        }
    )
    db.flush()


class _DayBoard:
    def __init__(self, room_ids: list[int]):
        self.room_free: dict[int, list[bool]] = {rid: [True] * SLOTS_PER_DAY for rid in room_ids}
        self.panel_free: dict[int, list[bool]] = {}
        self.student_free: dict[int, list[bool]] = {}
        self._panel_pointer: dict[int, int] = defaultdict(int)

    def ensure_panel(self, panel_id: int) -> None:
        self.panel_free.setdefault(panel_id, [True] * SLOTS_PER_DAY)

    def ensure_student(self, student_id: int) -> None:
        self.student_free.setdefault(student_id, [True] * SLOTS_PER_DAY)

    def next_panel_order(self, company_id: int, panel_ids: list[int]) -> list[int]:
        ptr = self._panel_pointer[company_id]
        self._panel_pointer[company_id] += 1
        n = len(panel_ids)
        return [panel_ids[(ptr + i) % n] for i in range(n)]


def _try_place(board: _DayBoard, student_id: int, company_id: int, panel_ids: list[int], num_units: int, min_start: int = 0):
    ordered_panels = board.next_panel_order(company_id, panel_ids)
    student_slots = board.student_free[student_id]

    for start in range(min_start, SLOTS_PER_DAY - num_units + 1):
        if not _free_run(student_slots, start, num_units):
            continue
        for panel_id in ordered_panels:
            panel_slots = board.panel_free[panel_id]
            if not _free_run(panel_slots, start, num_units):
                continue
            for room_id, room_slots in board.room_free.items():
                if _free_run(room_slots, start, num_units):
                    _mark(student_slots, start, num_units, False)
                    _mark(panel_slots, start, num_units, False)
                    _mark(room_slots, start, num_units, False)
                    return panel_id, room_id, start
    return None


def _diagnose_failure(
    board: _DayBoard,
    student_id: int,
    panel_ids: list[int],
    num_units: int,
    shortlist_count: int,
    panel_count: int,
    min_start: int = 0,
) -> str:
    capacity = panel_count * ((SLOTS_PER_DAY - min_start) // max(num_units, 1))

    panel_only_possible = any(
        _free_run(board.panel_free[pid], start, num_units)
        for pid in panel_ids
        for start in range(min_start, SLOTS_PER_DAY - num_units + 1)
    )
    if not panel_only_possible:
        return (
            f"Company's {panel_count} panel(s) are fully booked for the remaining day — "
            f"shortlist of {shortlist_count} exceeds effective capacity (~{capacity} interviews)."
        )

    student_slots = board.student_free[student_id]
    student_has_free_run = any(
        _free_run(student_slots, start, num_units) for start in range(min_start, SLOTS_PER_DAY - num_units + 1)
    )
    if not student_has_free_run:
        return "Student's day is already full with other companies' interviews — no free window left."

    return "Panel had a free window, but every room was occupied by other interviews at that time (room contention)."


def schedule_all(db: Session) -> dict:
    build_missing_interviews(db)

    room_ids = [rid for (rid,) in db.execute(select(Room.id).where(Room.available.is_(True)))]

    pending = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .join(Company, Shortlist.company_id == Company.id)
        .join(Student, Shortlist.student_id == Student.id)
        .filter(Interview.status == InterviewStatus.PENDING)
        .filter(Student.withdrawn.is_(False))
        .all()
    )

    by_day: dict[int, list[Interview]] = defaultdict(list)
    for interview in pending:
        by_day[interview.shortlist.company.scheduled_day].append(interview)

    scheduled_count = 0
    unscheduled_count = 0
    reason_counts: dict[str, int] = defaultdict(int)

    for day in range(1, NUM_DAYS + 1):
        interviews_today = by_day.get(day, [])
        if not interviews_today:
            continue

        board = _DayBoard(room_ids)

        companies_today: dict[int, Company] = {}
        by_company: dict[int, list[Interview]] = defaultdict(list)
        for iv in interviews_today:
            company = iv.shortlist.company
            companies_today[company.id] = company
            by_company[company.id].append(iv)
            board.ensure_student(iv.shortlist.student_id)

        ordered_companies = sorted(companies_today.values(), key=lambda c: c.priority_rank)

        for company in ordered_companies:
            active_panel_ids = [p.id for p in company.panels if p.active]
            for pid in active_panel_ids:
                board.ensure_panel(pid)

            company_interviews = sorted(
                by_company[company.id], key=lambda iv: iv.shortlist.student.cgpa, reverse=True
            )

            for iv in company_interviews:
                if not active_panel_ids:
                    iv.status = InterviewStatus.UNSCHEDULED
                    iv.unscheduled_reason = "Company has no active panels on its scheduled day."
                    unscheduled_count += 1
                    reason_counts["no_active_panels"] += 1
                    continue

                num_units = _units(iv.duration_minutes)
                student_id = iv.shortlist.student_id
                placement = _try_place(board, student_id, company.id, active_panel_ids, num_units)

                if placement:
                    panel_id, room_id, start = placement
                    iv.panel_id = panel_id
                    iv.room_id = room_id
                    iv.day = day
                    iv.start_slot = start
                    iv.status = InterviewStatus.SCHEDULED
                    iv.unscheduled_reason = None
                    scheduled_count += 1
                else:
                    reason = _diagnose_failure(
                        board, student_id, active_panel_ids, num_units, len(by_company[company.id]), len(active_panel_ids)
                    )
                    iv.status = InterviewStatus.UNSCHEDULED
                    iv.unscheduled_reason = reason
                    unscheduled_count += 1
                    if "panel(s) are fully booked" in reason:
                        reason_counts["company_capacity_exceeded"] += 1
                    elif "day is already full" in reason:
                        reason_counts["student_time_conflict"] += 1
                    else:
                        reason_counts["room_contention"] += 1

    db.commit()

    return {
        "total": scheduled_count + unscheduled_count,
        "scheduled": scheduled_count,
        "unscheduled": unscheduled_count,
        "unscheduled_reasons": dict(reason_counts),
    }
