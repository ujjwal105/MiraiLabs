import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Company, Panel, ReplanResult, Room, Student } from "../api/types";
import ReplanDiffView from "../components/ReplanDiff";

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
    <>
      <div className="panel">
        <h1>Replan</h1>
        <p className="muted">
          Inject a disruption and replan with one click. Only the interviews it actually invalidates
          move — everything else on the day stays exactly where it was.
        </p>
        <div className="replan-grid">
          <CompanyDelayCard companies={companies} onRun={runDisruption} />
          <PanelDropoutCard companies={companies} onRun={runDisruption} />
          <StudentWithdrawalCard onRun={runDisruption} />
          <RoomUnavailableCard rooms={rooms} onRun={runDisruption} />
        </div>
      </div>

      {error && (
        <div className="panel panel-error" style={{ marginTop: 16 }}>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="panel" style={{ marginTop: 16 }}>
          <ReplanDiffView result={result} />
        </div>
      )}
    </>
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
    <div className="replan-card">
      <h3>Company arrives late</h3>
      <p className="muted">Interviews inside the delay window get replanned to later in the day.</p>
      <select value={companyId} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Select company…</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} (day {c.scheduled_day})
          </option>
        ))}
      </select>
      <label className="replan-field">
        Delay (hours)
        <input
          type="number"
          min={0.25}
          step={0.25}
          value={delayHours}
          onChange={(e) => setDelayHours(Number(e.target.value))}
        />
      </label>
      <button className="btn-primary" disabled={companyId === "" || loading} onClick={submit}>
        {loading ? "Replanning…" : "Replan"}
      </button>
    </div>
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
    <div className="replan-card">
      <h3>Panel drops out</h3>
      <p className="muted">Its scheduled interviews get replanned onto the company's remaining panels.</p>
      <select value={companyId} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Select company…</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={panelId}
        onChange={(e) => setPanelId(e.target.value ? Number(e.target.value) : "")}
        disabled={panels.length === 0}
      >
        <option value="">{panels.length === 0 ? "No active panels" : "Select panel…"}</option>
        {panels.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <button className="btn-primary" disabled={panelId === "" || loading} onClick={submit}>
        {loading ? "Replanning…" : "Replan"}
      </button>
    </div>
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
    <div className="replan-card">
      <h3>Student withdraws</h3>
      <p className="muted">All their remaining interviews are cancelled; freed slots are backfilled from waitlists.</p>
      <div className="student-picker">
        <input
          type="text"
          placeholder="Search name or roll no…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button className="day-tab" onClick={search}>
          Search
        </button>
      </div>
      {results.length > 0 && !selected && (
        <div className="student-result-list">
          {results.map((s) => (
            <button key={s.id} className="student-result-item" onClick={() => setSelected(s)}>
              {s.name} — {s.roll_no} ({s.branch}, CGPA {s.cgpa}){s.withdrawn ? " · already withdrawn" : ""}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <p className="selected-tag">
          Selected: {selected.name} ({selected.roll_no})
        </p>
      )}
      <button className="btn-primary" disabled={!selected || loading} onClick={submit}>
        {loading ? "Replanning…" : "Withdraw & replan"}
      </button>
    </div>
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
    <div className="replan-card">
      <h3>Room becomes unavailable</h3>
      <p className="muted">Its scheduled interviews get replanned into another free room, or a new time.</p>
      <select value={roomId} onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Select room…</option>
        {availableRooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button className="btn-primary" disabled={roomId === "" || loading} onClick={submit}>
        {loading ? "Replanning…" : "Replan"}
      </button>
    </div>
  );
}
