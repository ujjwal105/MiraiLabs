from fastapi import APIRouter

from app.db import Base, SessionLocal, engine
from app.generator import generate_dataset
from app.scheduler import schedule_all

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


@router.post("/reset")
def reset_dataset():
    """Wipe the database and generate + schedule a fresh dataset. Uses its
    own session (not the request-scoped one) since it recreates the schema
    the current connection may already be holding open."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        generated = generate_dataset(db)
        scheduled = schedule_all(db)
    finally:
        db.close()

    return {"generated": generated, "scheduled": scheduled}
