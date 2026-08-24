import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Interview } from "../api/types";
import { categorizeReason } from "../lib/reasons";
import { TIER_LABEL } from "../lib/tiers";

const DAYS = [1, 2, 3, 4];

export default function Conflicts() {
  const [day, setDay] = useState<number | undefined>(undefined);
  const [conflicts, setConflicts] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .conflicts(day)
      .then(setConflicts)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [day]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conflicts;
    return conflicts.filter(
      (c) =>
        c.student.name.toLowerCase().includes(q) ||
        c.company.name.toLowerCase().includes(q) ||
        c.student.roll_no?.toLowerCase().includes(q),
    );
  }, [conflicts, query]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const c of conflicts) {
      const cat = categorizeReason(c.unscheduled_reason);
      const entry = map.get(cat.key) ?? { label: cat.label, count: 0 };
      entry.count += 1;
      map.set(cat.key, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [conflicts]);

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h1>Conflicts</h1>
        <div className="day-tabs">
          <button
            className={day === undefined ? "day-tab day-tab-active" : "day-tab"}
            onClick={() => setDay(undefined)}
          >
            All days
          </button>
          {DAYS.map((d) => (
            <button
              key={d}
              className={d === day ? "day-tab day-tab-active" : "day-tab"}
              onClick={() => setDay(d)}
            >
              Day {d}
            </button>
          ))}
        </div>
      </div>

      <p className="muted">
        {conflicts.length} interview{conflicts.length === 1 ? "" : "s"} could not be scheduled
        {day ? ` on day ${day}` : ""}.
      </p>

      <div className="chip-row">
        {byCategory.map((cat) => (
          <span key={cat.label} className="chip">
            <span className="chip-dot" />
            {cat.label}: {cat.count}
          </span>
        ))}
      </div>

      <input
        className="text-input"
        placeholder="Search student, roll no, or company…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="muted">Could not load conflicts: {error}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Roll No</th>
              <th>Company</th>
              <th>Tier</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.student.name}</td>
                <td>{c.student.roll_no}</td>
                <td>{c.company.name}</td>
                <td>{c.company.tier ? TIER_LABEL[c.company.tier] : ""}</td>
                <td className="muted">{c.unscheduled_reason}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No conflicts match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
