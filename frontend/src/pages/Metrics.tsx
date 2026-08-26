import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { api } from "@/api/client";
import type { Metrics as MetricsData } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatCard from "@/components/StatCard";
import { TIER_LABEL, TIER_ORDER } from "@/lib/tiers";

const DAYS = [1, 2, 3, 4];

const utilizationChartConfig = {
  utilization: { label: "Room utilization", color: "var(--series-1)" },
} satisfies ChartConfig;

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
      <Card className="border-destructive">
        <CardContent className="text-sm">Could not load metrics: {error}</CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const integrityOk =
    metrics.integrity.student_clashes === 0 &&
    metrics.integrity.room_double_bookings === 0 &&
    metrics.integrity.panel_double_bookings === 0;

  const utilizationData = DAYS.map((d) => ({
    day: `Day ${d}`,
    utilization: metrics.room_utilization_by_day[String(d)] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule quality</h1>
        <p className="text-sm text-muted-foreground">
          What "good" means here: high coverage, high room utilization, low student wait time, and zero
          integrity violations. No single number is the whole story — see the breakdowns below for why.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard value={`${metrics.coverage_pct}%`} label="Coverage (of active demand)" />
        <StatCard value={`${metrics.avg_student_wait_minutes}m`} label="Avg. gap between back-to-back interviews" />
        <StatCard value={metrics.scheduled} label="Scheduled" />
        <StatCard value={metrics.unscheduled} label="Unscheduled" />
        <StatCard value={metrics.cancelled} label="Cancelled (withdrawals)" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room utilization by day</CardTitle>
          <CardDescription>Near 100% means rooms — not panels or students — are the binding constraint that day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={utilizationChartConfig} className="max-h-[220px] w-full">
            <BarChart data={utilizationData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={36} unit="%" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="utilization" fill="var(--color-utilization)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage by day</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Room utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DAYS.map((d) => (
                <TableRow key={d}>
                  <TableCell>Day {d}</TableCell>
                  <TableCell>{metrics.coverage_by_day[String(d)] ?? "—"}%</TableCell>
                  <TableCell>{metrics.room_utilization_by_day[String(d)] ?? "—"}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage by company tier</CardTitle>
          <CardDescription>
            Priority protects a tier's <em>place in line</em> when a day is oversubscribed — it can't create
            room capacity that doesn't exist. Dream companies can still show lower coverage than niche ones
            if they land on a more crowded day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIER_ORDER.map((tier) => (
                <TableRow key={tier}>
                  <TableCell>{TIER_LABEL[tier]}</TableCell>
                  <TableCell>{metrics.coverage_by_tier[tier] ?? "—"}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrity checks</CardTitle>
          <CardDescription className={integrityOk ? undefined : "text-destructive"}>
            {integrityOk
              ? "All zero — the hard constraints (no student, room, or panel double-booked) hold."
              : "Violations detected — this should never happen; see values below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={metrics.integrity.student_clashes} label="Student clashes" />
            <StatCard value={metrics.integrity.room_double_bookings} label="Room double-bookings" />
            <StatCard value={metrics.integrity.panel_double_bookings} label="Panel double-bookings" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
