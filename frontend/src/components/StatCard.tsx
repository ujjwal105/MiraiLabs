import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  value: ReactNode;
  label: ReactNode;
  className?: string;
}

export default function StatCard({ value, label, className }: Props) {
  return (
    <Card className={cn("text-center", className)}>
      <CardContent className="flex flex-col items-center gap-1 py-2">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
