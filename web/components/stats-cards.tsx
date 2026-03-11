"use client";

import { useStats } from "@/lib/api";
import type { Job } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Layers,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Percent,
  Timer,
  FileText,
} from "lucide-react";

export function StatsCards({ jobs }: { jobs: Job[] }) {
  const { data: stats } = useStats();

  const total = stats?.jobs.total ?? jobs.length;
  const queued =
    stats?.jobs.queued ?? jobs.filter((j) => j.status === "queued").length;
  const running =
    stats?.jobs.running ?? jobs.filter((j) => j.status === "running").length;
  const completed =
    stats?.jobs.completed ?? jobs.filter((j) => j.status === "completed").length;
  const failed =
    stats?.jobs.failed ?? jobs.filter((j) => j.status === "failed").length;
  const queueDepth = stats?.queue_depth ?? 0;
  const avgTime = stats?.jobs.avg_response_time_ms ?? 0;
  const successRate =
    completed + failed > 0
      ? Math.round((completed / (completed + failed)) * 100)
      : 0;

  const cards = [
    { label: "Total Jobs", value: total, icon: Layers, color: "text-foreground" },
    {
      label: "Queued",
      value: `${queued} (${queueDepth} in Redis)`,
      icon: Clock,
      color: "text-muted-foreground",
    },
    {
      label: "Running",
      value: running,
      icon: Loader2,
      color: "text-primary",
      pulse: running > 0,
    },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "text-success" },
    { label: "Failed", value: failed, icon: XCircle, color: "text-destructive" },
    { label: "Success Rate", value: `${successRate}%`, icon: Percent, color: "text-warning" },
    {
      label: "Avg Response",
      value: `${avgTime.toFixed(0)}ms`,
      icon: Timer,
      color: "text-foreground",
    },
    {
      label: "Total Pages",
      value: stats?.jobs.total_pages_crawled ?? 0,
      icon: FileText,
      color: "text-primary",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={cn("size-3.5", card.color)} />
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
            </div>
            <p
              className={cn(
                "text-xl font-bold",
                card.color,
                card.pulse && "animate-pulse"
              )}
            >
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
