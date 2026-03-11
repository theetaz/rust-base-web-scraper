"use client";

import { useState } from "react";
import Link from "next/link";
import type { Job } from "@/lib/api";
import { StatusBadge } from "./status-badge";
import { useDeleteJob } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowUpDown, Search, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
        j.id.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created_at") cmp = a.created_at.localeCompare(b.created_at);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "mode") cmp = a.mode.localeCompare(b.mode);
      else if (sortKey === "pages_crawled")
        cmp = (a.pages_crawled ?? 0) - (b.pages_crawled ?? 0);
      return sortDesc ? -cmp : cmp;
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const handleDelete = (id: string) => {
    deleteJob.mutate(id, {
      onSuccess: () => toast.success("Job deleted"),
      onError: (err) => toast.error(`Delete failed: ${err.message}`),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search URL or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <div className="flex gap-1">
          {["all", "queued", "running", "completed", "failed"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {jobs.length} jobs
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("status")}
              >
                <span className="inline-flex items-center gap-1">
                  Status <ArrowUpDown className="size-3" />
                </span>
              </TableHead>
              <TableHead>URL</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("mode")}
              >
                <span className="inline-flex items-center gap-1">
                  Mode <ArrowUpDown className="size-3" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("pages_crawled")}
              >
                <span className="inline-flex items-center gap-1">
                  Pages <ArrowUpDown className="size-3" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("created_at")}
              >
                <span className="inline-flex items-center gap-1">
                  Created <ArrowUpDown className="size-3" />
                </span>
              </TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableRow key={job.id}>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-muted-foreground">{job.mode}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.pages_crawled ?? 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(job.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {duration}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/job/${job.id}`}>
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Job</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this job and all its
                              results. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(job.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No jobs matching filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
