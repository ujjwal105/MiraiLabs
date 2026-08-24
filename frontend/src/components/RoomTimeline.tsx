import { useMemo } from "react";
import type { Interview, Room } from "../api/types";
import { TIER_COLOR_VAR, TIER_LABEL, TIER_ORDER } from "../lib/tiers";

const SLOTS_PER_DAY = 32;
const DAY_START_HOUR = 9;
const HOURS = Array.from({ length: 9 }, (_, i) => DAY_START_HOUR + i); // 9..17

interface Props {
  rooms: Room[];
  interviews: Interview[]; // scheduled interviews for one day
}

export default function RoomTimeline({ rooms, interviews }: Props) {
  const byRoom = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const iv of interviews) {
      if (!iv.room) continue;
      const list = map.get(iv.room) ?? [];
      list.push(iv);
      map.set(iv.room, list);
    }
    return map;
  }, [interviews]);

  return (
    <div className="viz-root">
      <div className="timeline-legend">
        {TIER_ORDER.map((tier) => (
          <span key={tier} className="legend-item">
            <span className="legend-swatch" style={{ background: TIER_COLOR_VAR[tier] }} />
            {TIER_LABEL[tier]}
          </span>
        ))}
      </div>

      <div className="timeline-grid">
        <div className="timeline-row timeline-header">
          <div className="timeline-room-label" />
          <div className="timeline-track timeline-track-header">
            {HOURS.map((h) => (
              <span
                key={h}
                className="timeline-hour-mark"
                style={{ left: `${((h - DAY_START_HOUR) / 8) * 100}%` }}
              >
                {h}:00
              </span>
            ))}
          </div>
        </div>

        {rooms.map((room) => {
          const roomInterviews = byRoom.get(room.name) ?? [];
          return (
            <div className="timeline-row" key={room.id}>
              <div className="timeline-room-label">
                {room.name}
                {!room.available && <span className="tag tag-critical">unavailable</span>}
              </div>
              <div className="timeline-track">
                {roomInterviews.map((iv) => {
                  const left = ((iv.start_slot ?? 0) / SLOTS_PER_DAY) * 100;
                  const widthUnits = Math.max(1, Math.round(iv.duration_minutes / 15));
                  const width = (widthUnits / SLOTS_PER_DAY) * 100;
                  const color = TIER_COLOR_VAR[iv.company.tier ?? "regular"];
                  return (
                    <div
                      key={iv.id}
                      className="timeline-block"
                      style={{ left: `${left}%`, width: `${width}%`, background: color }}
                      title={`${iv.company.name} — ${iv.student.name} (${iv.student.roll_no})\n${iv.clock ?? ""} · ${iv.panel ?? ""}`}
                    >
                      <span className="timeline-block-label">{iv.company.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {rooms.length === 0 && <p className="muted">No rooms found.</p>}
      </div>
    </div>
  );
}
