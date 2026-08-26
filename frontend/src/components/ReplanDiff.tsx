import type { ReplanResult, ReplanSnapshot } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function SnapshotCell({ snap }: { snap?: ReplanSnapshot }) {
  if (!snap || snap.day === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      Day {snap.day}, {snap.clock} · {snap.room} · {snap.panel}
    </span>
  );
}

function StatusBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <Badge variant="outline" style={{ borderColor: color, color }}>
      {children}
    </Badge>
  );
}

export default function ReplanDiffView({ result }: { result: ReplanResult }) {
  const untouched = result.moved.length === 0 && result.cancelled.length === 0 && result.backfilled.length === 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{result.disruption}</h2>

      {untouched ? (
        <p className="text-sm text-muted-foreground">{result.note ?? "Nothing needed to change."}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <StatusBadge color="var(--status-warning)">Moved: {result.moved.length}</StatusBadge>
          <StatusBadge color="var(--status-critical)">Cancelled: {result.cancelled.length}</StatusBadge>
          <StatusBadge color="var(--status-good)">Backfilled: {result.backfilled.length}</StatusBadge>
        </div>
      )}

      {result.moved.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Moved</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.moved.map((row) => (
                <TableRow key={row.interview_id}>
                  <TableCell>
                    {row.student} ({row.roll_no})
                  </TableCell>
                  <TableCell>{row.company}</TableCell>
                  <TableCell>
                    <SnapshotCell snap={row.before} />
                  </TableCell>
                  <TableCell>
                    <SnapshotCell snap={row.after} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result.cancelled.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Cancelled</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Was</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.cancelled.map((row) => (
                <TableRow key={row.interview_id}>
                  <TableCell>
                    {row.student} ({row.roll_no})
                  </TableCell>
                  <TableCell>{row.company}</TableCell>
                  <TableCell>
                    <SnapshotCell snap={row.before} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result.backfilled.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Backfilled (waitlist promoted into freed slots)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>New slot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.backfilled.map((row) => (
                <TableRow key={row.interview_id}>
                  <TableCell>
                    {row.student} ({row.roll_no})
                  </TableCell>
                  <TableCell>{row.company}</TableCell>
                  <TableCell>
                    <SnapshotCell snap={row.after} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!untouched && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Who needs to be informed</h3>
          <p className="text-sm text-muted-foreground">Companies: {result.notify.companies.join(", ") || "none"}</p>
          {result.notify.students.length > 0 && (
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {result.notify.students.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
