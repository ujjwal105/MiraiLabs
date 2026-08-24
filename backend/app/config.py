from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'placement.db'}"

# Placement week scheduling grid.
# Every interview duration must be a multiple of SLOT_GRANULARITY_MINUTES so
# rooms/panels/students can be checked for overlap using integer slot units
# instead of arbitrary time arithmetic.
NUM_DAYS = 4
DAY_START_MINUTES = 9 * 60  # 9:00
DAY_END_MINUTES = 17 * 60  # 17:00
SLOT_GRANULARITY_MINUTES = 15
SLOTS_PER_DAY = (DAY_END_MINUTES - DAY_START_MINUTES) // SLOT_GRANULARITY_MINUTES


def slot_to_clock(slot: int) -> str:
    total_minutes = DAY_START_MINUTES + slot * SLOT_GRANULARITY_MINUTES
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"
