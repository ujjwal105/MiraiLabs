import { useMemo, useState } from "react";
import type { Interview, InterviewParty, Room } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIER_COLOR_VAR, TIER_LABEL, TIER_ORDER } from "@/lib/tiers";

const SLOTS_PER_DAY = 32;
const DAY_START_HOUR = 9;
const HOURS = Array.from({ length: 9 }, (_, i) => DAY_START_HOUR + i); // 9..17

// A 1px line every hour (8 hours across the day), aligned to the same
// percentages as the hour labels — the standard "gridlines behind events"
// treatment used by calendar/resource-timeline UIs, so rows stay scannable
// at a glance even where nothing is booked.
const HOUR_GRIDLINES = {
  backgroundImage:
    "repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent 12.5%)",
};

function slotToClock(slot: number): string {
  const totalMinutes = DAY_START_HOUR * 60 + slot * 15;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface RunSegment {
  key: string;
  startSlot: number;
  endSlot: number; // exclusive
  company: InterviewParty;
  interviews: Interview[];
}

// A room fully booked by one company for a stretch of the day is one fact,
// not thirty-two — merge back-to-back interviews for the same company into
// a single block. Individually bordering every 15-minute interview reads
// as a barcode, not a booking.
function mergeRuns(interviews: Interview[]): RunSegment[] {
  const sorted = [...interviews].sort((a, b) => (a.start_slot ?? 0) - (b.start_slot ?? 0));
  const runs: RunSegment[] = [];
  for (const iv of sorted) {
    const start = iv.start_slot ?? 0;
    const units = Math.max(1, Math.round(iv.duration_minutes / 15));
    const end = start + units;
    const last = runs[runs.length - 1];
    if (last && last.company.id === iv.company.id && last.endSlot === start) {
      last.endSlot = end;
      last.interviews.push(iv);
    } else {
      runs.push({ key: String(iv.id), startSlot: start, endSlot: end, company: iv.company, interviews: [iv] });
    }
  }
  return runs;
}

interface Props {
  rooms: Room[];
  interviews: Interview[]; // scheduled interviews for one day
  day: number;
}

export default function RoomTimeline({ rooms, interviews, day }: Props) {
  const [selected, setSelected] = useState<{ room: Room; run: RunSegment } | null>(null);

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
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {TIER_ORDER.map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: TIER_COLOR_VAR[tier] }}
            />
            {TIER_LABEL[tier]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <div className="flex items-stretch border-b bg-muted/40">
          <div className="sticky left-0 z-10 w-[92px] shrink-0 bg-muted/40" />
          <div className="relative h-7 min-w-[720px] flex-1">
            {HOURS.map((h, i) => (
              <span
                key={h}
                className="absolute top-1.5 text-[11px] text-muted-foreground"
                style={
                  i === HOURS.length - 1
                    ? { right: 4 }
                    : { left: `${((h - DAY_START_HOUR) / 8) * 100}%`, marginLeft: i === 0 ? 4 : 0 }
                }
              >
                {h}:00
              </span>
            ))}
          </div>
        </div>

        {rooms.map((room, idx) => {
          const runs = mergeRuns(byRoom.get(room.name) ?? []);
          const zebra = idx % 2 === 1;
          return (
            <div
              className={`flex items-stretch border-b last:border-b-0 ${zebra ? "bg-muted/20" : ""}`}
              key={room.id}
            >
              <div
                className={`sticky left-0 z-10 flex w-[92px] shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-xs text-muted-foreground ${zebra ? "bg-muted/20" : "bg-card"}`}
              >
                {room.name}
                {!room.available && (
                  <Badge variant="destructive" className="px-1 text-[10px]">
                    closed
                  </Badge>
                )}
              </div>
              <div className="relative h-9 min-w-[720px] flex-1" style={HOUR_GRIDLINES}>
                {runs.map((run) => {
                  const left = (run.startSlot / SLOTS_PER_DAY) * 100;
                  const width = ((run.endSlot - run.startSlot) / SLOTS_PER_DAY) * 100;
                  const color = TIER_COLOR_VAR[run.company.tier ?? "regular"];
                  const label =
                    run.interviews.length > 1 ? `${run.company.name} ×${run.interviews.length}` : run.company.name;
                  return (
                    <button
                      key={run.key}
                      type="button"
                      onClick={() => setSelected({ room, run })}
                      className="absolute inset-y-1 flex items-center overflow-hidden rounded-[3px] border-l-[3px] px-1.5 text-left transition-[filter] hover:brightness-125"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        borderLeftColor: color,
                        backgroundColor: `color-mix(in srgb, ${color} 30%, var(--card))`,
                      }}
                    >
                      <span className="truncate text-[11px] font-medium text-foreground">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {rooms.length === 0 && <p className="p-4 text-sm text-muted-foreground">No rooms found.</p>}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.run.company.name}
                  {selected.run.company.tier && (
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: TIER_COLOR_VAR[selected.run.company.tier],
                        color: TIER_COLOR_VAR[selected.run.company.tier],
                      }}
                    >
                      {TIER_LABEL[selected.run.company.tier]}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selected.room.name} · Day {day}, {slotToClock(selected.run.startSlot)}–
                  {slotToClock(selected.run.endSlot)} · {selected.run.interviews.length} interview
                  {selected.run.interviews.length > 1 ? "s" : ""}
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>CGPA</TableHead>
                    <TableHead>Panel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.run.interviews
                    .slice()
                    .sort((a, b) => (a.start_slot ?? 0) - (b.start_slot ?? 0))
                    .map((iv) => (
                      <TableRow key={iv.id}>
                        <TableCell>{iv.clock}</TableCell>
                        <TableCell>
                          {iv.student.name} ({iv.student.roll_no})
                        </TableCell>
                        <TableCell>{iv.student.branch}</TableCell>
                        <TableCell>{iv.student.cgpa}</TableCell>
                        <TableCell>{iv.panel}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
