"""Reset the database and generate a fresh realistic dataset.

Usage: python seed.py
"""

from app.db import Base, SessionLocal, engine, init_db
from app.generator import generate_dataset


def main() -> None:
    Base.metadata.drop_all(bind=engine)
    init_db()

    db = SessionLocal()
    try:
        stats = generate_dataset(db)
    finally:
        db.close()

    print("Dataset generated:")
    print(f"  Students:  {stats['num_students']}")
    print(f"  Companies: {stats['num_companies']} {stats['tier_counts']}")
    print(f"  Shortlist size — avg: {stats['avg_shortlist_size']}, max: {stats['max_shortlist_size']}")
    print("  Top students by number of shortlists:")
    for name, n in stats["top_students_by_shortlists"]:
        print(f"    {name}: {n}")


if __name__ == "__main__":
    main()
