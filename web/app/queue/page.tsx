"use client";

import { useQueueStatus, useStats } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

export default function QueuePage() {
  const { data: queue, isLoading: queueLoading } = useQueueStatus();
  const { data: stats } = useStats();

  if (queueLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Queue Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live view of job pipeline and worker activity
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const runningJobs = queue?.running_jobs ?? 0;
  const maxWorkers = queue?.max_workers ?? 3;
  const workerUtilization =
    maxWorkers > 0 ? Math.round((runningJobs / maxWorkers) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Queue Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live view of job pipeline and worker activity
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <PipelineCard
          label="Queue Depth"
          value={queue?.queue_depth ?? 0}
          sub="waiting in Redis"
          color="text-muted-foreground"
          pulse={false}
        />
        <PipelineCard
          label="Running"
          value={runningJobs}
          sub={`of ${maxWorkers} workers`}
          color="text-primary"
          pulse={runningJobs > 0}
        />
        <PipelineCard
          label="Completed"
          value={stats?.jobs.completed ?? 0}
          sub="total"
          color="text-success"
          pulse={false}
        />
        <PipelineCard
          label="Failed"
          value={stats?.jobs.failed ?? 0}
          sub="total"
          color="text-destructive"
          pulse={false}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Worker Slots</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {workerUtilization}% utilized
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={workerUtilization} className="mb-4" />
          <div className="flex gap-2">
            {Array.from({ length: maxWorkers }).map((_, i) => {
              const isActive = i < runningJobs;
              return (
                <div
                  key={i}
                  className={`flex-1 h-10 rounded-md border flex items-center justify-center text-xs font-medium transition-all ${isActive
                      ? "bg-primary/10 border-primary/50 text-primary animate-pulse"
                      : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                >
                  Worker {i + 1}
                  {isActive && (
                    <span className="ml-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pipeline Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <PipelineStage
              label="Queued"
              count={queue?.queued_jobs ?? 0}
              variant="secondary"
            />
            <ArrowRight className="size-5 text-muted-foreground" />
            <PipelineStage
              label="Running"
              count={runningJobs}
              variant="default"
              active
            />
            <ArrowRight className="size-5 text-muted-foreground" />
            <div className="flex gap-3">
              <PipelineStage
                label="Completed"
                count={stats?.jobs.completed ?? 0}
                variant="success"
              />
              <PipelineStage
                label="Failed"
                count={stats?.jobs.failed ?? 0}
                variant="destructive"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Total Pages Crawled
              </p>
              <p className="text-2xl font-bold">
                {stats.jobs.total_pages_crawled}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Avg Response Time
              </p>
              <p className="text-2xl font-bold">
                {stats.jobs.avg_response_time_ms.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold">
                {stats.jobs.completed + stats.jobs.failed > 0
                  ? Math.round(
                    (stats.jobs.completed /
                      (stats.jobs.completed + stats.jobs.failed)) *
                    100
                  )
                  : 0}
                %
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <div className="divide-y divide-border">
              {(queue?.recent_activity ?? []).length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No activity yet
                </div>
              )}
              {(queue?.recent_activity ?? []).map((activity) => (
                <div
                  key={activity.id}
                  className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
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
                  <Badge variant="outline" className="text-xs">
                    {activity.mode}
                  </Badge>
                  {activity.pages_crawled != null &&
                    activity.pages_crawled > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {activity.pages_crawled}p
                      </span>
                    )}
                  <TimeAgo date={activity.created_at} />
                  {activity.error && (
                    <span
                      className="text-xs text-destructive truncate max-w-32"
                      title={activity.error}
                    >
                      {activity.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
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
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-3xl font-bold ${color} ${pulse ? "animate-pulse" : ""}`}
        >
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function PipelineStage({
  label,
  count,
  variant,
  active,
}: {
  label: string;
  count: number;
  variant: "default" | "secondary" | "destructive" | "success";
  active?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-muted/30 ${active ? "animate-pulse" : ""}`}
    >
      <span className="text-2xl font-bold">{count}</span>
      <Badge variant={variant} className="text-xs">
        {label}
      </Badge>
    </div>
  );
}

function TimeAgo({ date }: { date: string }) {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
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
