# Placement Week Scheduler

A system for scheduling and replanning campus placement week interviews across
companies, students, rooms, and panels — built to survive the chaos of the
actual day (late arrivals, panel drops, withdrawals, room outages).

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: React, Vite, TypeScript, Tailwind CSS + shadcn/ui (sidebar layout, charts via Recharts)

## Architecture

```
backend/app/
  models.py        Company, Panel, Room, Student, Shortlist, Interview (SQLAlchemy)
  generator.py      realistic dataset generator (35 companies / 4 tiers, 800 students, 20 rooms)
  scheduler.py       initial feasible schedule: greedy day-by-day earliest-fit
  replanner.py        the 4 disruption handlers + minimal-disturbance repair + backfill
  metrics.py           schedule-quality metrics (coverage, utilization, wait time, integrity)
  routers/            dataset reset, disruption endpoints, read/query endpoints

frontend/src/
  pages/Dashboard.tsx    overview stats + scheduled-vs-unscheduled-by-day chart
  pages/Schedule.tsx      day-tabbed room-by-room timeline (the whiteboard, but it doesn't collapse)
  pages/Conflicts.tsx      what couldn't be scheduled, categorized, searchable
  pages/Replan.tsx          one-click disruption triggers + diff summary
  pages/Metrics.tsx          schedule-quality numbers, reported per day and per tier
```

## Running it

Backend:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # http://localhost:8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

On first run, use the "Reset & regenerate dataset" button on the Dashboard (or
`POST /api/dataset/reset`) to generate and schedule a fresh dataset. `backend/seed.py`
does the same thing from the command line.

## Design decisions

### 1. What does a "good" schedule mean here?

No single number is enough, so `/api/metrics` (rendered on the **Metrics**
page) reports four kinds of thing, and they're kept separate on purpose:

- **Coverage** — the percentage of shortlisted interviews actually placed,
  reported overall *and* broken down by day and by company tier. Overall
  coverage on a representative run: **~71%**. That is not a bug — see below.
- **Room utilization** — booked room-minutes ÷ available room-minutes, per
  day. On the same run, days 1–3 sit at **~100%** utilization while day 4
  sits at **~67%**. This is the single most useful number for a coordinator:
  it says *rooms, not panels or students, are the binding constraint* on the
  first three days, and that day 4 has slack that a better day-assignment
  policy could use.
- **Average student wait** — the gap between a student's back-to-back
  interviews on the same day. On the same run this averages **~116 minutes**.
  That's an honest finding, not a flattering one: the greedy scheduler
  optimizes for *how many interviews fit*, company by company, and never
  tries to pack one student's own day tightly. A student-centric packing pass
  would lower this number without changing coverage — noted below as the
  clearest next improvement.
- **Integrity checks** — student clashes, room double-bookings, panel
  double-bookings. These must always read **zero**; they are proof the hard
  constraints hold, not a trade-off to optimize.

Coverage alone would have told a misleadingly rosy story if it weren't paired
with utilization: 71% coverage next to 100% room utilization means the
system isn't leaving capacity on the table — the demand (shortlist volume)
genuinely exceeds what 20 rooms can hold on the crowded days. That distinction
— "we're out of room" vs. "we're scheduling badly" — is the reason multiple
metrics are reported instead of one.

### 2. When the schedule is infeasible, which constraint bends first — and who decides?

**The system decides, using a fixed and disclosed policy — not a coordinator
judgment call made in the moment.** Every company has a `priority_rank`
(visible via `/api/companies`), assigned by tier, most-protected first:

> **Dream > Niche > Regular > Day-1 mass recruiter**

Rationale: dream-company panels are senior, rare, and rigid — the hardest to
reschedule around, so they get first claim on rooms/time. Niche companies
draw from a tiny, branch-restricted eligible pool with no slack to absorb a
bump. Regular companies have some flexibility. Mass recruiters run deep panels
(6–10) with short interviews (15 min), so they have the most slack to absorb
disruption — they bend first.

This is a deliberate choice to automate rather than defer to the coordinator
in real time, for a practical reason: at 800 students and 35 companies, no
one is going to make 500+ individually-reasoned bump decisions in the middle
of a live disruption. A fixed, published policy means the outcome is
*predictable and explainable* ("mass recruiters flex first, always") rather
than ad hoc.

What the coordinator *does* retain: full visibility before anything is
final. Every replan action returns a diff (who moved, who was cancelled and
why, who got backfilled) before it's treated as settled — the "Replan" page
shows this immediately after triggering a disruption. The honest gap in the
current build: the API applies the replan and returns the diff in the same
call, rather than a propose-then-confirm step. Given more time, the next
version would split `POST /api/disrupt/*` into a dry-run preview and a
separate commit step, so the coordinator can reject a specific proposal
before it's written to the database — right now, "one-click" means the click
commits.

### 3. How much reshuffling is acceptable during a replan?

**As little as physically possible — enforced structurally, not by policy.**
`replanner.py`'s `_build_day_board` only counts interviews *other than* the
ones actually invalidated by the disruption as "frozen, already-occupied
ground truth." The repair search only ever runs over the interviews the
disruption broke; everything else literally never enters the search space,
so it cannot move. A 2-hour delay for one company cannot cascade into
reshuffling the whole day, because the other 30-odd companies' interviews
aren't examined at all, let alone touched.

This was verified directly, not just designed-for: chaining all four
disruption types against the same dataset and checking room/panel
double-bookings and total-interview conservation afterward (see commit
history) confirmed no interview outside the affected set ever changes.

The one place the system *chooses* to touch interviews beyond the strictly
broken set is the opportunistic backfill step: after a repair, if a
cancellation freed a room/panel/slot that would otherwise sit idle for the
rest of the day, the day's own waitlist (previously-unscheduled interviews)
gets a chance to fill it — most-protected company and highest CGPA first.
This is additive, not disruptive: it only ever turns an UNSCHEDULED interview
into a SCHEDULED one in a slot nobody else was using; it never moves an
already-scheduled interview to make room. Backfilling is why a "Company
arrives 2 hours late" replan can show `moved: 0, cancelled: 56, backfilled:
56` — the delayed company's own interviews couldn't be re-fit into an
already-saturated day, but their vacated slots didn't go to waste.

## Known limitations / what I'd do next

- **Greedy, not optimal.** The scheduler is a day-by-day earliest-fit list
  scheduler, not a CP-SAT/ILP solver. It's transparent (any placement is
  explainable in one sentence) and fast enough to rerun on demand, but it
  likely leaves a few percent of coverage on the table that a full solver
  would recover. Chosen deliberately for explainability in a live defense.
- **Replan is apply-then-report, not preview-then-confirm.** Discussed above.
- **No persistent replan history.** Each replan call returns its own diff,
  but the system doesn't keep a running log of "everything that happened
  today" across multiple disruptions — only the current schedule state and
  each individual diff response. A coordinator reviewing the whole day's
  churn after the fact would need the diffs captured client-side as they
  happen.
- **Student wait time isn't optimized.** Flagged as a finding, not fixed —
  see metric #1 above.
