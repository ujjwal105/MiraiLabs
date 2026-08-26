import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import type { Interview } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categorizeReason } from "@/lib/reasons";
import { TIER_LABEL } from "@/lib/tiers";

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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Conflicts</CardTitle>
          <p className="text-sm text-muted-foreground">
            {conflicts.length} interview{conflicts.length === 1 ? "" : "s"} could not be scheduled
            {day ? ` on day ${day}` : ""}.
          </p>
        </div>
        <Tabs value={day === undefined ? "all" : String(day)} onValueChange={(v) => setDay(v === "all" ? undefined : Number(v))}>
          <TabsList>
            <TabsTrigger value="all">All days</TabsTrigger>
            {DAYS.map((d) => (
              <TabsTrigger key={d} value={String(d)}>
                Day {d}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {byCategory.map((cat) => (
            <Badge key={cat.label} variant="destructive">
              {cat.label}: {cat.count}
            </Badge>
          ))}
        </div>

        <Input
          placeholder="Search student, roll no, or company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error && <p className="text-sm text-muted-foreground">Could not load conflicts: {error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.student.name}</TableCell>
                  <TableCell>{c.student.roll_no}</TableCell>
                  <TableCell>{c.company.name}</TableCell>
                  <TableCell>{c.company.tier ? TIER_LABEL[c.company.tier] : ""}</TableCell>
                  <TableCell className="text-muted-foreground">{c.unscheduled_reason}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No conflicts match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
