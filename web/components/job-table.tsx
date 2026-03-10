"use client";

import { useState } from "react";
import Link from "next/link";
import type { Job } from "@/lib/api";
import { StatusBadge } from "./status-badge";
import { useDeleteJob } from "@/lib/api";

type SortKey = "created_at" | "status" | "mode" | "pages_crawled";

export function JobTable({ jobs }: { jobs: Job[] }) {
  const deleteJob = useDeleteJob();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState("");

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No jobs yet.{" "}
        <Link href="/playground" className="text-primary hover:underline">
          Try the Playground
        </Link>{" "}
        or{" "}
        <Link href="/new" className="text-primary hover:underline">
          submit a new job
        </Link>
      </div>
    );
  }

  const filtered = jobs
    .filter((j) => statusFilter === "all" || j.status === statusFilter)
    .filter(
      (j) =>
        !search ||
        j.url.toLowerCase().includes(search.toLowerCase()) ||
        j.id.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created_at") {
        cmp = a.created_at.localeCompare(b.created_at);
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      } else if (sortKey === "mode") {
        cmp = a.mode.localeCompare(b.mode);
      } else if (sortKey === "pages_crawled") {
        cmp = (a.pages_crawled ?? 0) - (b.pages_crawled ?? 0);
      }
      return sortDesc ? -cmp : cmp;
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) =>
    sortKey === column ? (
      <span className="ml-1 text-[10px]">{sortDesc ? "v" : "^"}</span>
    ) : null;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search URL or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-1">
          {["all", "queued", "running", "completed", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {jobs.length} jobs
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card">
              <Th onClick={() => handleSort("status")}>
                Status
                <SortIcon column="status" />
              </Th>
              <th className="text-left p-3 text-muted-foreground font-medium">
                URL
              </th>
              <Th onClick={() => handleSort("mode")}>
                Mode
                <SortIcon column="mode" />
              </Th>
              <Th onClick={() => handleSort("pages_crawled")}>
                Pages
                <SortIcon column="pages_crawled" />
              </Th>
              <Th onClick={() => handleSort("created_at")}>
                Created
                <SortIcon column="created_at" />
              </Th>
              <th className="text-left p-3 text-muted-foreground font-medium">
                Duration
              </th>
              <th className="text-left p-3 text-muted-foreground font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => {
              const duration =
                job.started_at && job.completed_at
                  ? (
                      (new Date(job.completed_at).getTime() -
                        new Date(job.started_at).getTime()) /
                      1000
                    ).toFixed(1) + "s"
                  : job.started_at
                    ? "..."
                    : "-";
              return (
                <tr
                  key={job.id}
                  className="border-b border-border hover:bg-accent/50 transition-colors"
                >
                  <td className="p-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/job/${job.id}`}
                      className="text-primary hover:underline truncate block max-w-xs"
                      title={job.url}
                    >
                      {job.url.length > 55
                        ? job.url.substring(0, 55) + "..."
                        : job.url}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {job.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{job.mode}</td>
                  <td className="p-3 text-muted-foreground">
                    {job.pages_crawled ?? 0}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs font-mono">
                    {duration}
                  </td>
                  <td className="p-3 flex gap-2">
                    <Link
                      href={`/job/${job.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm("Delete this job?"))
                          deleteJob.mutate(job.id);
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-muted-foreground"
                >
                  No jobs matching filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="text-left p-3 text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none"
    >
      {children}
    </th>
  );
}
