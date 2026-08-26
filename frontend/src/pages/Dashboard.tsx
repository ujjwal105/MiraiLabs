import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { StateSummary } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DayBreakdownChart from "@/components/DayBreakdownChart";
import StatCard from "@/components/StatCard";

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
      <Card className="border-destructive">
        <CardContent className="space-y-2 text-sm">
          <p>Could not reach the backend at the configured API URL.</p>
          <p className="font-mono text-xs text-muted-foreground break-all">{error}</p>
          <p>
            Is the FastAPI server running (<code>uvicorn app.main:app --reload</code>)?
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const conflictCount = summary.interviews_by_status.unscheduled ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Current state of placement week.</p>
        </div>
        <Button variant="outline" onClick={handleReset} disabled={resetting}>
          {resetting ? "Resetting…" : "Reset & regenerate dataset"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard value={summary.total_students} label="Students" />
        <StatCard value={summary.total_companies} label="Companies" />
        <StatCard value={summary.total_rooms} label="Rooms" />
        <StatCard value={summary.interviews_by_status.scheduled ?? 0} label="Scheduled interviews" />
        <StatCard
          value={conflictCount}
          label={
            <Link to="/conflicts" className="underline-offset-2 hover:underline">
              Unscheduled →
            </Link>
          }
        />
        <StatCard value={summary.withdrawn_students} label="Withdrawn students" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled vs. unscheduled, by day</CardTitle>
          <CardDescription>
            See the full room-by-room layout in{" "}
            <Link to="/schedule" className="underline-offset-2 hover:underline">
              Schedule
            </Link>
            , or what couldn't be placed in{" "}
            <Link to="/conflicts" className="underline-offset-2 hover:underline">
              Conflicts
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DayBreakdownChart
            scheduledByDay={summary.scheduled_by_day}
            unscheduledByDay={summary.unscheduled_by_day}
          />
        </CardContent>
      </Card>
    </div>
  );
}
