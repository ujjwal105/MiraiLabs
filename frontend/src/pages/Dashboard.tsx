import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { StateSummary } from "../api/types";
import DayBreakdownChart from "../components/DayBreakdownChart";

export default function Dashboard() {
  const [summary, setSummary] = useState<StateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => {
    api
      .stateSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      await api.resetDataset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

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

  const conflictCount = summary.interviews_by_status.unscheduled ?? 0;

  return (
    <>
      <div className="panel">
        <div className="panel-header-row">
          <h1>Dashboard</h1>
          <button className="day-tab" onClick={handleReset} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset & regenerate dataset"}
          </button>
        </div>
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
            <div className="stat-value">{conflictCount}</div>
            <div className="stat-label">
              <Link to="/conflicts">Unscheduled →</Link>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{summary.withdrawn_students}</div>
            <div className="stat-label">Withdrawn students</div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <DayBreakdownChart
          scheduledByDay={summary.scheduled_by_day}
          unscheduledByDay={summary.unscheduled_by_day}
        />
        <p className="muted" style={{ marginTop: 12 }}>
          See the full room-by-room layout in <Link to="/schedule">Schedule</Link>, or the list of
          interviews that couldn't be placed in <Link to="/conflicts">Conflicts</Link>.
        </p>
      </div>
    </>
  );
}
