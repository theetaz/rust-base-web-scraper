"use client";

import { useJobs } from "@/lib/api";
import { StatsCards } from "@/components/stats-cards";
import { JobTable } from "@/components/job-table";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data, isLoading, error } = useJobs();

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load jobs: {(error as Error).message}
      </div>
    );
  }

  const jobs = data?.jobs ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <StatsCards jobs={jobs} />
      <JobTable jobs={jobs} />
    </div>
  );
}
