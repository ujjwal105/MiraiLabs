import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface Props {
  scheduledByDay: Record<string, number>;
  unscheduledByDay: Record<string, number>;
}

const DAYS = [1, 2, 3, 4];

const chartConfig = {
  scheduled: { label: "Scheduled", color: "var(--status-good)" },
  unscheduled: { label: "Unscheduled", color: "var(--status-critical)" },
} satisfies ChartConfig;

export default function DayBreakdownChart({ scheduledByDay, unscheduledByDay }: Props) {
  const data = DAYS.map((d) => ({
    day: `Day ${d}`,
    scheduled: scheduledByDay[String(d)] ?? 0,
    unscheduled: unscheduledByDay[String(d)] ?? 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="max-h-[260px] w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} tickMargin={10} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="scheduled" fill="var(--color-scheduled)" radius={4} />
        <Bar dataKey="unscheduled" fill="var(--color-unscheduled)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
