"""Generates a realistic placement-week dataset.

Tier design rationale (this is a judgment call the assignment asks us to
defend, not an arbitrary default):

- DAY1_MASS_RECRUITER: low CGPA cutoff, huge shortlists, many panels, short
  interviews. These are the bulk-hiring service companies that always go
  first so the eligible pool hasn't been thinned out by placements yet.
- DREAM: high CGPA cutoff, long interviews, few panels (senior interviewers,
  scarce and expensive to reschedule), scheduled late in the week once the
  "safety net" placements are largely done.
- REGULAR / NICHE: fill the middle days. NICHE additionally restricts to a
  branch subset (e.g. a core-engineering or embedded-systems firm).

Priority rank (1 = most protected when the schedule has to bend) follows
DREAM > NICHE > REGULAR > DAY1_MASS_RECRUITER: dream-company panels are
rigid and rare, niche companies draw from a small eligible pool with no
slack, regular companies have some flexibility, and mass recruiters have
deep panels/short interviews and can absorb reshuffling most easily.
"""

import random

from faker import Faker
from sqlalchemy.orm import Session

from app.models import Company, CompanyTier, Panel, Room, Shortlist, Student

BRANCHES = {
    "CSE": 0.22,
    "IT": 0.13,
    "ECE": 0.15,
    "EEE": 0.10,
    "MECH": 0.14,
    "CIVIL": 0.09,
    "CHEM": 0.07,
    "AI_DS": 0.10,
}

NICHE_BRANCH_POOLS = [
    ["CSE", "IT", "AI_DS"],
    ["ECE", "EEE"],
    ["MECH", "CIVIL"],
    ["AI_DS", "ECE"],
]

TIER_CONFIG = {
    CompanyTier.DAY1_MASS_RECRUITER: dict(
        count=5,
        cgpa_range=(6.0, 6.5),
        duration_choices=[10, 15],
        panels_range=(6, 10),
        shortlist_range=(220, 380),
        day_weights={1: 1.0},
        branch_restricted=False,
    ),
    CompanyTier.DREAM: dict(
        count=4,
        cgpa_range=(8.3, 9.2),
        duration_choices=[45, 60],
        panels_range=(2, 3),
        shortlist_range=(60, 140),
        day_weights={3: 0.5, 4: 0.5},
        branch_restricted=False,
    ),
    CompanyTier.REGULAR: dict(
        count=18,
        cgpa_range=(6.5, 7.6),
        duration_choices=[20, 30],
        panels_range=(3, 5),
        shortlist_range=(70, 200),
        day_weights={1: 0.1, 2: 0.35, 3: 0.3, 4: 0.25},
        branch_restricted=False,
    ),
    CompanyTier.NICHE: dict(
        count=8,
        cgpa_range=(7.0, 8.2),
        duration_choices=[30, 40],
        panels_range=(2, 3),
        shortlist_range=(25, 80),
        day_weights={2: 0.3, 3: 0.35, 4: 0.35},
        branch_restricted=True,
    ),
}

PRIORITY_TIER_ORDER = [
    CompanyTier.DREAM,
    CompanyTier.NICHE,
    CompanyTier.REGULAR,
    CompanyTier.DAY1_MASS_RECRUITER,
]


def _weighted_day(rng: random.Random, day_weights: dict[int, float]) -> int:
    days = list(day_weights.keys())
    weights = list(day_weights.values())
    return rng.choices(days, weights=weights, k=1)[0]


def _make_students(db: Session, fake: Faker, rng: random.Random, count: int) -> list[Student]:
    branches = list(BRANCHES.keys())
    branch_weights = list(BRANCHES.values())
    students = []
    for i in range(count):
        cgpa = rng.gauss(7.2, 0.9)
        cgpa = max(5.0, min(9.8, cgpa))
        student = Student(
            roll_no=f"R{i + 1:04d}",
            name=fake.name(),
            branch=rng.choices(branches, weights=branch_weights, k=1)[0],
            cgpa=round(cgpa, 2),
        )
        students.append(student)
    db.add_all(students)
    db.flush()
    return students


def _make_rooms(db: Session, count: int) -> list[Room]:
    rooms = [Room(name=f"Room-{i + 1}") for i in range(count)]
    db.add_all(rooms)
    db.flush()
    return rooms


def _make_companies(db: Session, fake: Faker, rng: random.Random) -> list[Company]:
    companies = []
    for tier, cfg in TIER_CONFIG.items():
        for _ in range(cfg["count"]):
            cutoff = round(rng.uniform(*cfg["cgpa_range"]), 2)
            duration = rng.choice(cfg["duration_choices"])
            panel_count = rng.randint(*cfg["panels_range"])
            company = Company(
                name=fake.unique.company(),
                tier=tier,
                cgpa_cutoff=cutoff,
                interview_duration_minutes=duration,
                scheduled_day=_weighted_day(rng, cfg["day_weights"]),
                priority_rank=0,  # assigned after all companies are created
            )
            db.add(company)
            db.flush()

            for p in range(panel_count):
                db.add(Panel(company_id=company.id, label=f"P{p + 1}"))

            company._branch_filter = (
                rng.choice(NICHE_BRANCH_POOLS) if cfg["branch_restricted"] else None
            )
            company._shortlist_range = cfg["shortlist_range"]
            companies.append(company)
    db.flush()
    return companies


def _assign_priority_ranks(companies: list[Company], rng: random.Random) -> None:
    rank = 1
    for tier in PRIORITY_TIER_ORDER:
        tier_companies = [c for c in companies if c.tier == tier]
        rng.shuffle(tier_companies)
        for c in tier_companies:
            c.priority_rank = rank
            rank += 1


def _make_shortlists(db: Session, companies: list[Company], students: list[Student], rng: random.Random) -> None:
    for company in companies:
        branch_filter = getattr(company, "_branch_filter", None)
        shortlist_range = getattr(company, "_shortlist_range", (50, 150))

        eligible = [s for s in students if s.cgpa >= company.cgpa_cutoff]
        if branch_filter:
            eligible = [s for s in eligible if s.branch in branch_filter]

        target = rng.randint(*shortlist_range)
        size = min(target, len(eligible))
        chosen = rng.sample(eligible, size) if size else []

        for student in chosen:
            db.add(Shortlist(student_id=student.id, company_id=company.id))
    db.flush()


def generate_dataset(db: Session, num_students: int = 800, num_rooms: int = 20, seed: int = 42) -> dict:
    rng = random.Random(seed)
    fake = Faker()
    Faker.seed(seed)

    students = _make_students(db, fake, rng, num_students)
    rooms = _make_rooms(db, num_rooms)
    companies = _make_companies(db, fake, rng)
    _assign_priority_ranks(companies, rng)
    db.flush()
    _make_shortlists(db, companies, students, rng)
    db.commit()

    return summarize(db, companies, students)


def summarize(db: Session, companies: list[Company], students: list[Student]) -> dict:
    from collections import Counter

    from sqlalchemy import func

    from app.models import Shortlist

    shortlist_counts = dict(
        db.query(Shortlist.company_id, func.count(Shortlist.id)).group_by(Shortlist.company_id).all()
    )
    per_student_counts = dict(
        db.query(Shortlist.student_id, func.count(Shortlist.id)).group_by(Shortlist.student_id).all()
    )
    top_students = sorted(per_student_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    top_students_named = [
        (next(s.name for s in students if s.id == sid), n) for sid, n in top_students
    ]

    return {
        "num_students": len(students),
        "num_companies": len(companies),
        "tier_counts": dict(Counter(c.tier.value for c in companies)),
        "avg_shortlist_size": round(sum(shortlist_counts.values()) / len(shortlist_counts), 1)
        if shortlist_counts
        else 0,
        "max_shortlist_size": max(shortlist_counts.values(), default=0),
        "top_students_by_shortlists": top_students_named,
    }
