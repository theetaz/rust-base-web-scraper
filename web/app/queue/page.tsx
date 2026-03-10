"use client";

import { useQueueStatus, useStats } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

export default function QueuePage() {
  const { data: queue, isLoading: queueLoading } = useQueueStatus();
  const { data: stats } = useStats();

  if (queueLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Queue Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live view of job pipeline and worker activity
        </p>
      </div>

      {/* Pipeline overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <PipelineCard
          label="Queue Depth"
          value={queue?.queue_depth ?? 0}
          sub="waiting in Redis"
          color="text-zinc-300"
          pulse={false}
        />
        <PipelineCard
          label="Running"
          value={queue?.running_jobs ?? 0}
          sub={`of ${queue?.max_workers ?? 0} workers`}
          color="text-blue-400"
          pulse={(queue?.running_jobs ?? 0) > 0}
        />
        <PipelineCard
          label="Completed"
          value={stats?.jobs.completed ?? 0}
          sub="total"
          color="text-green-400"
          pulse={false}
        />
        <PipelineCard
          label="Failed"
          value={stats?.jobs.failed ?? 0}
          sub="total"
          color="text-red-400"
          pulse={false}
        />
      </div>

      {/* Worker slots visualization */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-3">Worker Slots</h2>
        <div className="flex gap-2">
          {Array.from({ length: queue?.max_workers ?? 3 }).map((_, i) => {
            const isActive = i < (queue?.running_jobs ?? 0);
            return (
              <div
                key={i}
                className={`flex-1 h-10 rounded-md border flex items-center justify-center text-xs font-medium transition-all ${
                  isActive
                    ? "bg-blue-900/30 border-blue-700 text-blue-400 animate-pulse"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                Worker {i + 1}
                {isActive && (
                  <span className="ml-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline flow visualization */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-4">Pipeline Flow</h2>
        <div className="flex items-center justify-between">
          <PipelineStage
            label="Queued"
            count={queue?.queued_jobs ?? 0}
            color="bg-zinc-700"
            textColor="text-zinc-300"
          />
          <Arrow />
          <PipelineStage
            label="Running"
            count={queue?.running_jobs ?? 0}
            color="bg-blue-900/50"
            textColor="text-blue-400"
            active
          />
          <Arrow />
          <div className="flex gap-3">
            <PipelineStage
              label="Completed"
              count={stats?.jobs.completed ?? 0}
              color="bg-green-900/50"
              textColor="text-green-400"
            />
            <PipelineStage
              label="Failed"
              count={stats?.jobs.failed ?? 0}
              color="bg-red-900/50"
              textColor="text-red-400"
            />
          </div>
        </div>
      </div>

      {/* Throughput stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Total Pages Crawled</p>
            <p className="text-2xl font-bold">
              {stats.jobs.total_pages_crawled}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Avg Response Time</p>
            <p className="text-2xl font-bold">
              {stats.jobs.avg_response_time_ms.toFixed(0)}ms
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-2xl font-bold">
              {stats.jobs.completed + stats.jobs.failed > 0
                ? Math.round(
                    (stats.jobs.completed /
                      (stats.jobs.completed + stats.jobs.failed)) *
                      100,
                  )
                : 0}
              %
            </p>
          </div>
        </div>
      )}

      {/* Recent activity feed */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {(queue?.recent_activity ?? []).length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No activity yet
            </div>
          )}
          {(queue?.recent_activity ?? []).map((activity) => (
            <div
              key={activity.id}
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/30 transition-colors"
            >
              <StatusBadge status={activity.status} />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/job/${activity.id}`}
                  className="text-sm text-primary hover:underline truncate block"
                >
                  {activity.url}
                </Link>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {activity.mode}
              </span>
              {activity.pages_crawled != null && activity.pages_crawled > 0 && (
                <span className="text-xs text-muted-foreground">
                  {activity.pages_crawled}p
                </span>
              )}
              <TimeAgo date={activity.created_at} />
              {activity.error && (
                <span
                  className="text-xs text-red-400 truncate max-w-32"
                  title={activity.error}
                >
                  {activity.error}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelineCard({
  label,
  value,
  sub,
  color,
  pulse,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
  pulse: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold ${color} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function PipelineStage({
  label,
  count,
  color,
  textColor,
  active,
}: {
  label: string;
  count: number;
  color: string;
  textColor: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg ${color} ${active ? "animate-pulse" : ""}`}
    >
      <span className={`text-2xl font-bold ${textColor}`}>{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-muted-foreground px-2">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function TimeAgo({ date }: { date: string }) {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000,
  );
  let text: string;
  if (seconds < 60) text = `${seconds}s ago`;
  else if (seconds < 3600) text = `${Math.floor(seconds / 60)}m ago`;
  else if (seconds < 86400) text = `${Math.floor(seconds / 3600)}h ago`;
  else text = `${Math.floor(seconds / 86400)}d ago`;

  return (
    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
      {text}
    </span>
  );
}
