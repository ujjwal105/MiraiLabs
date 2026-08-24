interface Props {
  scheduledByDay: Record<string, number>;
  unscheduledByDay: Record<string, number>;
}

const DAYS = [1, 2, 3, 4];

export default function DayBreakdownChart({ scheduledByDay, unscheduledByDay }: Props) {
  const max = Math.max(
    1,
    ...DAYS.map((d) => scheduledByDay[String(d)] ?? 0),
    ...DAYS.map((d) => unscheduledByDay[String(d)] ?? 0),
  );

  return (
    <div className="viz-root">
      <h2>Scheduled vs. unscheduled, by day</h2>
      <div className="bar-chart">
        {DAYS.map((d) => {
          const scheduled = scheduledByDay[String(d)] ?? 0;
          const unscheduled = unscheduledByDay[String(d)] ?? 0;
          return (
            <div className="bar-chart-group" key={d}>
              <div className="bar-chart-bars">
                <div
                  className="bar-chart-bar"
                  style={{ height: `${(scheduled / max) * 100}%`, background: "var(--status-good)" }}
                  title={`Day ${d} — scheduled: ${scheduled}`}
                >
                  <span className="bar-chart-value">{scheduled}</span>
                </div>
                <div
                  className="bar-chart-bar"
                  style={{ height: `${(unscheduled / max) * 100}%`, background: "var(--status-critical)" }}
                  title={`Day ${d} — unscheduled: ${unscheduled}`}
                >
                  <span className="bar-chart-value">{unscheduled}</span>
                </div>
              </div>
              <span className="bar-chart-label">Day {d}</span>
            </div>
          );
        })}
      </div>
      <div className="bar-chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--status-good)" }} />
          Scheduled
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--status-critical)" }} />
          Unscheduled
        </span>
      </div>
    </div>
  );
}
