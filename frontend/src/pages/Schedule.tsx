import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Interview, Room } from "../api/types";
import RoomTimeline from "../components/RoomTimeline";

const DAYS = [1, 2, 3, 4];

export default function Schedule() {
  const [day, setDay] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.rooms(), api.interviews({ day, status: "scheduled", limit: 2000 })])
      .then(([r, ivs]) => {
        setRooms(r);
        setInterviews(ivs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [day]);

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h1>Schedule</h1>
        <div className="day-tabs">
          {DAYS.map((d) => (
            <button
              key={d}
              className={d === day ? "day-tab day-tab-active" : "day-tab"}
              onClick={() => setDay(d)}
            >
              Day {d}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">
        {interviews.length} scheduled interviews across {rooms.length} rooms on day {day}.
      </p>
      {error && <p className="muted">Could not load schedule: {error}</p>}
      {loading ? <p className="muted">Loading…</p> : <RoomTimeline rooms={rooms} interviews={interviews} />}
    </div>
  );
}
