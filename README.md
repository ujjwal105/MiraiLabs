# Placement Week Scheduler

A system for scheduling and replanning campus placement week interviews across
companies, students, rooms, and panels — built to survive the chaos of the
actual day (late arrivals, panel drops, withdrawals, room outages).

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: React, Vite, TypeScript

## Status

Work in progress. See commit history for build order:
scaffolding → data models → dataset generator → scheduler → replanner → API → dashboard.

## Running the backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
