from app.config import slot_to_clock
from app.models import Company, Interview, Room, Student


def interview_to_dict(iv: Interview) -> dict:
    student = iv.shortlist.student
    company = iv.shortlist.company
    return {
        "id": iv.id,
        "student": {
            "id": student.id,
            "name": student.name,
            "roll_no": student.roll_no,
            "branch": student.branch,
            "cgpa": student.cgpa,
        },
        "company": {"id": company.id, "name": company.name, "tier": company.tier.value},
        "status": iv.status.value,
        "day": iv.day,
        "start_slot": iv.start_slot,
        "clock": slot_to_clock(iv.start_slot) if iv.start_slot is not None else None,
        "duration_minutes": iv.duration_minutes,
        "room": iv.room.name if iv.room else None,
        "panel": iv.panel.label if iv.panel else None,
        "unscheduled_reason": iv.unscheduled_reason,
    }


def company_to_dict(c: Company, scheduled: int = None, unscheduled: int = None, total: int = None) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "tier": c.tier.value,
        "cgpa_cutoff": c.cgpa_cutoff,
        "interview_duration_minutes": c.interview_duration_minutes,
        "scheduled_day": c.scheduled_day,
        "priority_rank": c.priority_rank,
        "arrival_delay_minutes": c.arrival_delay_minutes,
        "panels": [{"id": p.id, "label": p.label, "active": p.active} for p in c.panels],
        "scheduled": scheduled,
        "unscheduled": unscheduled,
        "total": total,
    }


def room_to_dict(r: Room) -> dict:
    return {"id": r.id, "name": r.name, "available": r.available}


def student_to_dict(s: Student) -> dict:
    return {
        "id": s.id,
        "roll_no": s.roll_no,
        "name": s.name,
        "branch": s.branch,
        "cgpa": s.cgpa,
        "withdrawn": s.withdrawn,
    }
