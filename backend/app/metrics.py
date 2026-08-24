"""Schedule-quality metrics.

Answers "what does a good schedule mean here?" with numbers instead of a
feeling:

- coverage: percentage of interviews actually placed (overall, per day, per
  company tier) — the headline number, but not the only one that matters.
- room utilization: booked room-minutes / available room-minutes per day —
  a schedule can hit 100% coverage and still waste half the rooms, or the
  reverse.
- average student wait: the gap between a student's back-to-back interviews
  on the same day. A student's day being "technically non-overlapping" is not
  the same as it being humane.
- integrity checks (student clashes, room/panel double-bookings): these
  should always read zero — they are proof the hard constraints hold, not a
  quality trade-off.

Replan churn (how much a disruption moved) is reported per-action in the
replan diff itself (moved/cancelled/backfilled counts), not as a global
metric here — there is no accumulated event log in this system, by design;
see the README for that trade-off.
"""

from collections import defaultdict

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import SLOT_GRANULARITY_MINUTES, SLOTS_PER_DAY
from app.models import Company, Interview, InterviewStatus, Room, Shortlist


def _pct(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0


def compute_metrics(db: Session) -> dict:
    total = db.query(Interview).count()
    scheduled = db.query(Interview).filter(Interview.status == InterviewStatus.SCHEDULED).count()
    unscheduled = db.query(Interview).filter(Interview.status == InterviewStatus.UNSCHEDULED).count()
    cancelled = db.query(Interview).filter(Interview.status == InterviewStatus.CANCELLED).count()
    active_demand = scheduled + unscheduled  # excludes withdrawals, which are no longer "demand"

    scheduled_interviews = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .all()
    )

    # --- coverage, per day and per tier ---
    by_day_total: dict[int, int] = defaultdict(int)
    by_day_scheduled: dict[int, int] = defaultdict(int)
    by_tier_total: dict[str, int] = defaultdict(int)
    by_tier_scheduled: dict[str, int] = defaultdict(int)

    all_active = (
        db.query(Interview)
        .join(Shortlist, Interview.shortlist_id == Shortlist.id)
        .join(Company, Shortlist.company_id == Company.id)
        .filter(Interview.status.in_([InterviewStatus.SCHEDULED, InterviewStatus.UNSCHEDULED]))
        .all()
    )
    for iv in all_active:
        day = iv.shortlist.company.scheduled_day
        tier = iv.shortlist.company.tier.value
        by_day_total[day] += 1
        by_tier_total[tier] += 1
        if iv.status == InterviewStatus.SCHEDULED:
            by_day_scheduled[day] += 1
            by_tier_scheduled[tier] += 1

    coverage_by_day = {d: _pct(by_day_scheduled[d], by_day_total[d]) for d in by_day_total}
    coverage_by_tier = {t: _pct(by_tier_scheduled[t], by_tier_total[t]) for t in by_tier_total}

    # --- room utilization: booked room-minutes / available room-minutes, per day ---
    num_rooms = db.query(Room).filter(Room.available.is_(True)).count()
    day_capacity_units = num_rooms * SLOTS_PER_DAY
    booked_units_by_day: dict[int, int] = defaultdict(int)
    for iv in scheduled_interviews:
        units = max(1, round(iv.duration_minutes / SLOT_GRANULARITY_MINUTES))
        booked_units_by_day[iv.day] += units
    room_utilization_by_day = {
        d: _pct(booked_units_by_day[d], day_capacity_units) for d in booked_units_by_day
    }

    # --- average student wait: gap between back-to-back interviews, same day ---
    by_student_day: dict[tuple[int, int], list[Interview]] = defaultdict(list)
    for iv in scheduled_interviews:
        by_student_day[(iv.shortlist.student_id, iv.day)].append(iv)

    gaps_minutes = []
    for ivs in by_student_day.values():
        if len(ivs) < 2:
            continue
        ivs.sort(key=lambda x: x.start_slot)
        for prev, nxt in zip(ivs, ivs[1:]):
            prev_units = max(1, round(prev.duration_minutes / SLOT_GRANULARITY_MINUTES))
            gap_slots = nxt.start_slot - (prev.start_slot + prev_units)
            gaps_minutes.append(gap_slots * SLOT_GRANULARITY_MINUTES)

    avg_wait_minutes = round(sum(gaps_minutes) / len(gaps_minutes), 1) if gaps_minutes else 0.0

    # --- integrity checks: these must always read zero ---
    student_clashes = 0
    for ivs in by_student_day.values():
        if len(ivs) < 2:
            continue
        ivs.sort(key=lambda x: x.start_slot)
        for prev, nxt in zip(ivs, ivs[1:]):
            prev_units = max(1, round(prev.duration_minutes / SLOT_GRANULARITY_MINUTES))
            if nxt.start_slot < prev.start_slot + prev_units:
                student_clashes += 1

    room_double_bookings = db.execute(
        text(
            "select count(*) from ("
            "  select room_id, day, start_slot from interviews"
            "  where status='scheduled' group by room_id, day, start_slot having count(*) > 1"
            ")"
        )
    ).scalar()
    panel_double_bookings = db.execute(
        text(
            "select count(*) from ("
            "  select panel_id, day, start_slot from interviews"
            "  where status='scheduled' group by panel_id, day, start_slot having count(*) > 1"
            ")"
        )
    ).scalar()

    return {
        "total_interviews": total,
        "scheduled": scheduled,
        "unscheduled": unscheduled,
        "cancelled": cancelled,
        "coverage_pct": _pct(scheduled, active_demand),
        "coverage_by_day": coverage_by_day,
        "coverage_by_tier": coverage_by_tier,
        "room_utilization_by_day": room_utilization_by_day,
        "avg_student_wait_minutes": avg_wait_minutes,
        "integrity": {
            "student_clashes": student_clashes,
            "room_double_bookings": room_double_bookings,
            "panel_double_bookings": panel_double_bookings,
        },
    }
