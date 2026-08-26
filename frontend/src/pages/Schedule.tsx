import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Interview, Room } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RoomTimeline from "@/components/RoomTimeline";

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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Schedule</CardTitle>
          <p className="text-sm text-muted-foreground">
            {interviews.length} scheduled interviews across {rooms.length} rooms on day {day}.
          </p>
        </div>
        <Tabs value={String(day)} onValueChange={(v) => setDay(Number(v))}>
          <TabsList>
            {DAYS.map((d) => (
              <TabsTrigger key={d} value={String(d)}>
                Day {d}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-muted-foreground">Could not load schedule: {error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <RoomTimeline rooms={rooms} interviews={interviews} day={day} />
        )}
      </CardContent>
    </Card>
  );
}
