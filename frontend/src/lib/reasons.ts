export interface ReasonCategory {
  key: string;
  label: string;
}

// Mirrors the reason strings produced by backend/app/scheduler.py and
// replanner.py — kept as substring matches since the backend emits
// human-readable text rather than a machine-readable code.
export function categorizeReason(reason: string | null): ReasonCategory {
  if (!reason) return { key: "unknown", label: "Unknown" };
  if (reason.includes("fully booked")) {
    return { key: "company_capacity", label: "Company capacity exceeded" };
  }
  if (reason.includes("day is already full")) {
    return { key: "student_conflict", label: "Student's day already full" };
  }
  if (reason.includes("room was occupied") || reason.includes("room contention")) {
    return { key: "room_contention", label: "Room contention" };
  }
  if (reason.includes("no active panels") || reason.includes("no remaining active panels")) {
    return { key: "no_panels", label: "No active panels" };
  }
  if (reason.includes("withdrew")) {
    return { key: "withdrawn", label: "Student withdrew" };
  }
  return { key: "other", label: "Other" };
}
