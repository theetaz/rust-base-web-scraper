"use client";

import { useStats } from "@/lib/api";
import type { Job } from "@/lib/api";

export function StatsCards({ jobs }: { jobs: Job[] }) {
  const { data: stats } = useStats();

  const total = stats?.jobs.total ?? jobs.length;
  const queued = stats?.jobs.queued ?? jobs.filter((j) => j.status === "queued").length;
  const running = stats?.jobs.running ?? jobs.filter((j) => j.status === "running").length;
  const completed = stats?.jobs.completed ?? jobs.filter((j) => j.status === "completed").length;
  const failed = stats?.jobs.failed ?? jobs.filter((j) => j.status === "failed").length;
  const queueDepth = stats?.queue_depth ?? 0;
  const avgTime = stats?.jobs.avg_response_time_ms ?? 0;
  const successRate =
    completed + failed > 0
      ? Math.round((completed / (completed + failed)) * 100)
      : 0;

  const cards = [
    { label: "Total Jobs", value: total, color: "text-foreground" },
    { label: "Queued", value: `${queued} (${queueDepth} in Redis)`, color: "text-zinc-400" },
    { label: "Running", value: running, color: "text-blue-400", pulse: running > 0 },
    { label: "Completed", value: completed, color: "text-green-400" },
    { label: "Failed", value: failed, color: "text-red-400" },
    { label: "Success Rate", value: `${successRate}%`, color: "text-warning" },
    { label: "Avg Response", value: `${avgTime.toFixed(0)}ms`, color: "text-foreground" },
    { label: "Total Pages", value: stats?.jobs.total_pages_crawled ?? 0, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-card border border-border rounded-lg p-3"
        >
          <p className="text-[11px] text-muted-foreground">{card.label}</p>
          <p
            className={`text-xl font-bold ${card.color} ${card.pulse ? "animate-pulse" : ""}`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
