import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Metrics as MetricsData } from "../api/types";
import { TIER_LABEL, TIER_ORDER } from "../lib/tiers";

const DAYS = [1, 2, 3, 4];

export default function Metrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .metrics()
      .then(setMetrics)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="panel panel-error">
        <p>Could not load metrics: {error}</p>
      </div>
    );
  }

  if (!metrics) {
    return <div className="panel">Loading…</div>;
  }

  const integrityOk =
    metrics.integrity.student_clashes === 0 &&
    metrics.integrity.room_double_bookings === 0 &&
    metrics.integrity.panel_double_bookings === 0;

  return (
    <>
      <div className="panel">
        <h1>Schedule quality</h1>
        <p className="muted">
          What "good" means here: high coverage, high room utilization, low student wait time, and zero
          integrity violations. No single number is the whole story — see the per-day breakdown below for
          why.
        </p>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-value">{metrics.coverage_pct}%</div>
            <div className="stat-label">Coverage (of active demand)</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{metrics.avg_student_wait_minutes}m</div>
            <div className="stat-label">Avg. gap between back-to-back interviews</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{metrics.scheduled}</div>
            <div className="stat-label">Scheduled</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{metrics.unscheduled}</div>
            <div className="stat-label">Unscheduled</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{metrics.cancelled}</div>
            <div className="stat-label">Cancelled (withdrawals)</div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Coverage &amp; room utilization by day</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Coverage</th>
              <th>Room utilization</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td>Day {d}</td>
                <td>{metrics.coverage_by_day[String(d)] ?? "—"}%</td>
                <td>{metrics.room_utilization_by_day[String(d)] ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 10 }}>
          Room utilization near 100% means rooms — not panels or students — are the binding constraint
          that day.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Coverage by company tier</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {TIER_ORDER.map((tier) => (
              <tr key={tier}>
                <td>{TIER_LABEL[tier]}</td>
                <td>{metrics.coverage_by_tier[tier] ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 10 }}>
          Priority protects a tier's <em>place in line</em> when a day is oversubscribed — it can't create
          room capacity that doesn't exist. Dream companies can still show lower coverage than niche ones if
          they land on a more crowded day.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Integrity checks</h2>
        <p className={integrityOk ? "muted" : ""} style={!integrityOk ? { color: "var(--status-critical)" } : undefined}>
          {integrityOk
            ? "All zero — the hard constraints (no student, room, or panel double-booked) hold."
            : "Violations detected — this should never happen; see values below."}
        </p>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-value">{metrics.integrity.student_clashes}</div>
            <div className="stat-label">Student clashes</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{metrics.integrity.room_double_bookings}</div>
            <div className="stat-label">Room double-bookings</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{metrics.integrity.panel_double_bookings}</div>
            <div className="stat-label">Panel double-bookings</div>
          </div>
        </div>
      </div>
    </>
  );
}
