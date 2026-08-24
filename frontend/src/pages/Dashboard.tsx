import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { StateSummary } from "../api/types";

export default function Dashboard() {
  const [summary, setSummary] = useState<StateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .stateSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="panel panel-error">
        <p>Could not reach the backend at the configured API URL.</p>
        <p className="panel-error-detail">{error}</p>
        <p>Is the FastAPI server running (`uvicorn app.main:app --reload`)?</p>
      </div>
    );
  }

  if (!summary) {
    return <div className="panel">Loading…</div>;
  }

  return (
    <div className="panel">
      <h1>Dashboard</h1>
      <p className="muted">Backend connected. Full coordinator view lands here next.</p>
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-value">{summary.total_students}</div>
          <div className="stat-label">Students</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{summary.total_companies}</div>
          <div className="stat-label">Companies</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{summary.total_rooms}</div>
          <div className="stat-label">Rooms</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{summary.interviews_by_status.scheduled ?? 0}</div>
          <div className="stat-label">Scheduled interviews</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{summary.interviews_by_status.unscheduled ?? 0}</div>
          <div className="stat-label">Unscheduled</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{summary.withdrawn_students}</div>
          <div className="stat-label">Withdrawn students</div>
        </div>
      </div>
    </div>
  );
}
