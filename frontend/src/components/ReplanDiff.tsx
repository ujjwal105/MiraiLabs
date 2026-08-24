import type { ReplanResult, ReplanSnapshot } from "../api/types";

function SnapshotCell({ snap }: { snap?: ReplanSnapshot }) {
  if (!snap || snap.day === null) return <span className="muted">—</span>;
  return (
    <span>
      Day {snap.day}, {snap.clock} · {snap.room} · {snap.panel}
    </span>
  );
}

export default function ReplanDiffView({ result }: { result: ReplanResult }) {
  const untouched = result.moved.length === 0 && result.cancelled.length === 0 && result.backfilled.length === 0;

  return (
    <div className="viz-root">
      <div className="diff-summary-header">
        <h2>{result.disruption}</h2>
      </div>

      {untouched ? (
        <p className="muted">{result.note ?? "Nothing needed to change."}</p>
      ) : (
        <div className="chip-row">
          <span className="chip">
            <span className="chip-dot" style={{ background: "var(--status-warning)" }} />
            Moved: {result.moved.length}
          </span>
          <span className="chip">
            <span className="chip-dot" style={{ background: "var(--status-critical)" }} />
            Cancelled: {result.cancelled.length}
          </span>
          <span className="chip">
            <span className="chip-dot" style={{ background: "var(--status-good)" }} />
            Backfilled: {result.backfilled.length}
          </span>
        </div>
      )}

      {result.moved.length > 0 && (
        <>
          <h3>Moved</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Company</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {result.moved.map((row) => (
                <tr key={row.interview_id}>
                  <td>
                    {row.student} ({row.roll_no})
                  </td>
                  <td>{row.company}</td>
                  <td>
                    <SnapshotCell snap={row.before} />
                  </td>
                  <td>
                    <SnapshotCell snap={row.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {result.cancelled.length > 0 && (
        <>
          <h3>Cancelled</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Company</th>
                <th>Was</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.cancelled.map((row) => (
                <tr key={row.interview_id}>
                  <td>
                    {row.student} ({row.roll_no})
                  </td>
                  <td>{row.company}</td>
                  <td>
                    <SnapshotCell snap={row.before} />
                  </td>
                  <td className="muted">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {result.backfilled.length > 0 && (
        <>
          <h3>Backfilled (waitlist promoted into freed slots)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Company</th>
                <th>New slot</th>
              </tr>
            </thead>
            <tbody>
              {result.backfilled.map((row) => (
                <tr key={row.interview_id}>
                  <td>
                    {row.student} ({row.roll_no})
                  </td>
                  <td>{row.company}</td>
                  <td>
                    <SnapshotCell snap={row.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!untouched && (
        <>
          <h3>Who needs to be informed</h3>
          <p className="muted">Companies: {result.notify.companies.join(", ") || "none"}</p>
          {result.notify.students.length > 0 && (
            <ul>
              {result.notify.students.map((msg) => (
                <li key={msg} className="muted">
                  {msg}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
