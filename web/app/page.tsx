"use client";

import { useJobs } from "@/lib/api";
import { StatsCards } from "@/components/stats-cards";
import { JobTable } from "@/components/job-table";

export default function DashboardPage() {
  const { data, isLoading, error } = useJobs();

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
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
