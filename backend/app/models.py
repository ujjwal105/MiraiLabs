import enum

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class CompanyTier(str, enum.Enum):
    DAY1_MASS_RECRUITER = "day1_mass_recruiter"  # hires in bulk, shortlists hundreds
    DREAM = "dream"  # highly selective, top students overlap heavily on these lists
    REGULAR = "regular"
    NICHE = "niche"  # narrow branch/skill requirement, small shortlist


class InterviewStatus(str, enum.Enum):
    PENDING = "pending"  # not yet scheduled
    SCHEDULED = "scheduled"
    UNSCHEDULED = "unscheduled"  # scheduler could not place it — see unscheduled_reason
    CANCELLED = "cancelled"  # student withdrew / company cancelled etc.


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    tier: Mapped[CompanyTier] = mapped_column(SAEnum(CompanyTier))
    cgpa_cutoff: Mapped[float] = mapped_column(Float)
    interview_duration_minutes: Mapped[int] = mapped_column(Integer)
    scheduled_day: Mapped[int] = mapped_column(Integer)  # 1..NUM_DAYS
    # Lower number = higher priority. Used to decide whose interviews get
    # bumped first when the schedule is infeasible or a replan must shed load.
    priority_rank: Mapped[int] = mapped_column(Integer, default=100)
    # Disruption state: hours the company arrives late on its scheduled day.
    arrival_delay_minutes: Mapped[int] = mapped_column(Integer, default=0)

    panels: Mapped[list["Panel"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    shortlists: Mapped[list["Shortlist"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class Panel(Base):
    __tablename__ = "panels"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    label: Mapped[str] = mapped_column(String)  # e.g. "P1"
    active: Mapped[bool] = mapped_column(default=True)  # False once dropped mid-day

    company: Mapped[Company] = relationship(back_populates="panels")
    interviews: Mapped[list["Interview"]] = relationship(back_populates="panel")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    available: Mapped[bool] = mapped_column(default=True)  # False once pulled out of use

    interviews: Mapped[list["Interview"]] = relationship(back_populates="room")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    roll_no: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    branch: Mapped[str] = mapped_column(String)
    cgpa: Mapped[float] = mapped_column(Float)
    # True once the student has withdrawn (e.g. accepted another offer).
    # Any of their still-pending interviews should be cancelled on replan.
    withdrawn: Mapped[bool] = mapped_column(default=False)

    shortlists: Mapped[list["Shortlist"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Shortlist(Base):
    """A student being shortlisted by a company — the source of one interview."""

    __tablename__ = "shortlists"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))

    student: Mapped[Student] = relationship(back_populates="shortlists")
    company: Mapped[Company] = relationship(back_populates="shortlists")
    interview: Mapped["Interview"] = relationship(
        back_populates="shortlist", uselist=False, cascade="all, delete-orphan"
    )


class Interview(Base):
    """The schedulable unit: one shortlist entry placed onto (or failing to be
    placed onto) a day/time-slot/room/panel."""

    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    shortlist_id: Mapped[int] = mapped_column(ForeignKey("shortlists.id"), unique=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    panel_id: Mapped[int | None] = mapped_column(ForeignKey("panels.id"), nullable=True)

    day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Start slot index within the day's grid (see config.SLOT_GRANULARITY_MINUTES).
    start_slot: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer)

    status: Mapped[InterviewStatus] = mapped_column(SAEnum(InterviewStatus), default=InterviewStatus.PENDING)
    unscheduled_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    shortlist: Mapped[Shortlist] = relationship(back_populates="interview")
    room: Mapped[Room | None] = relationship(back_populates="interviews")
    panel: Mapped[Panel | None] = relationship(back_populates="interviews")
