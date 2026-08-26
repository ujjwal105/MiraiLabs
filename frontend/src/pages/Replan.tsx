import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Company, Panel, ReplanResult, Room, Student } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReplanDiffView from "@/components/ReplanDiff";

type Runner = (fn: () => Promise<ReplanResult>) => Promise<void>;

export default function Replan() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [result, setResult] = useState<ReplanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.companies().then(setCompanies).catch(() => undefined);
    api.rooms().then(setRooms).catch(() => undefined);
  }, []);

  const runDisruption: Runner = async (fn) => {
    setError(null);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Replan</h1>
        <p className="text-sm text-muted-foreground">
          Inject a disruption and replan with one click. Only the interviews it actually invalidates
          move — everything else on the day stays exactly where it was.
        </p>
      </div>

      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompanyDelayCard companies={companies} onRun={runDisruption} />
        <PanelDropoutCard companies={companies} onRun={runDisruption} />
        <StudentWithdrawalCard onRun={runDisruption} />
        <RoomUnavailableCard rooms={rooms} onRun={runDisruption} />
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="text-sm">{error}</CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent>
            <ReplanDiffView result={result} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompanyDelayCard({ companies, onRun }: { companies: Company[]; onRun: Runner }) {
  const [companyId, setCompanyId] = useState<number | "">("");
  const [delayHours, setDelayHours] = useState(2);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (companyId === "") return;
    setLoading(true);
    await onRun(() => api.disruptCompanyDelay(Number(companyId), delayHours));
    setLoading(false);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base">Company arrives late</CardTitle>
        <CardDescription className="min-h-[3.75rem]">
          Interviews inside the delay window get replanned to later in the day.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <Select value={companyId === "" ? undefined : String(companyId)} onValueChange={(v) => setCompanyId(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select company…" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} (day {c.scheduled_day})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1.5">
          <Label htmlFor="delay-hours">Delay (hours)</Label>
          <Input
            id="delay-hours"
            type="number"
            min={0.25}
            step={0.25}
            value={delayHours}
            onChange={(e) => setDelayHours(Number(e.target.value))}
          />
        </div>
        <Button className="mt-auto" disabled={companyId === "" || loading} onClick={submit}>
          {loading ? "Replanning…" : "Replan"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PanelDropoutCard({ companies, onRun }: { companies: Company[]; onRun: Runner }) {
  const [companyId, setCompanyId] = useState<number | "">("");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panelId, setPanelId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPanelId("");
    if (companyId === "") {
      setPanels([]);
      return;
    }
    api.panels(Number(companyId)).then((p) => setPanels(p.filter((x) => x.active)));
  }, [companyId]);

  const submit = async () => {
    if (panelId === "") return;
    setLoading(true);
    await onRun(() => api.disruptPanelDropout(Number(panelId)));
    setLoading(false);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base">Panel drops out</CardTitle>
        <CardDescription className="min-h-[3.75rem]">
          Its scheduled interviews get replanned onto the company's remaining panels.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <Select value={companyId === "" ? undefined : String(companyId)} onValueChange={(v) => setCompanyId(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select company…" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={panelId === "" ? undefined : String(panelId)}
          onValueChange={(v) => setPanelId(Number(v))}
          disabled={panels.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={panels.length === 0 ? "No active panels" : "Select panel…"} />
          </SelectTrigger>
          <SelectContent>
            {panels.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="mt-auto" disabled={panelId === "" || loading} onClick={submit}>
          {loading ? "Replanning…" : "Replan"}
        </Button>
      </CardContent>
    </Card>
  );
}

function StudentWithdrawalCard({ onRun }: { onRun: Runner }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    const found = await api.students(query.trim());
    setResults(found);
  };

  const submit = async () => {
    if (!selected) return;
    setLoading(true);
    await onRun(() => api.disruptStudentWithdrawal(selected.id));
    setLoading(false);
    setSelected(null);
    setResults([]);
    setQuery("");
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base">Student withdraws</CardTitle>
        <CardDescription className="min-h-[3.75rem]">
          All their remaining interviews are cancelled; freed slots are backfilled from waitlists.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search name or roll no…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button variant="outline" onClick={search}>
            Search
          </Button>
        </div>
        {results.length > 0 && !selected && (
          <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
            {results.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="rounded-md border px-2 py-1.5 text-left text-sm hover:border-primary"
              >
                {s.name} — {s.roll_no} ({s.branch}, CGPA {s.cgpa})
                {s.withdrawn ? " · already withdrawn" : ""}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <Badge variant="secondary">
            Selected: {selected.name} ({selected.roll_no})
          </Badge>
        )}
        <Button className="mt-auto" disabled={!selected || loading} onClick={submit}>
          {loading ? "Replanning…" : "Withdraw & replan"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RoomUnavailableCard({ rooms, onRun }: { rooms: Room[]; onRun: Runner }) {
  const [roomId, setRoomId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (roomId === "") return;
    setLoading(true);
    await onRun(() => api.disruptRoomUnavailable(Number(roomId)));
    setLoading(false);
  };

  const availableRooms = rooms.filter((r) => r.available);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base">Room becomes unavailable</CardTitle>
        <CardDescription className="min-h-[3.75rem]">
          Its scheduled interviews get replanned into another free room, or a new time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <Select value={roomId === "" ? undefined : String(roomId)} onValueChange={(v) => setRoomId(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select room…" />
          </SelectTrigger>
          <SelectContent>
            {availableRooms.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="mt-auto" disabled={roomId === "" || loading} onClick={submit}>
          {loading ? "Replanning…" : "Replan"}
        </Button>
      </CardContent>
    </Card>
  );
}
