"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useJob, useDeleteJob } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "markdown" | "metadata" | "raw";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: job, isLoading, error } = useJob(id);
  const deleteJob = useDeleteJob();
  const [expandedResult, setExpandedResult] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<Tab>("markdown");

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading job...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-12 text-destructive">
        {error ? (error as Error).message : "Job not found"}
      </div>
    );
  }

  const handleDelete = async () => {
    if (confirm("Delete this job and all its results?")) {
      await deleteJob.mutateAsync(id);
      router.push("/");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold">Job Detail</h1>
        <StatusBadge status={job.status} />
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {job.task_id}
        </span>
        <button
          onClick={handleDelete}
          className="text-xs text-destructive hover:underline"
        >
          Delete
        </button>
      </div>

      {/* Job info card */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">URL</p>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all text-sm"
            >
              {job.url}
            </a>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Mode</p>
            <p className="font-medium">{job.mode}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Pages Crawled</p>
            <p className="font-medium">{job.pages_crawled}</p>
          </div>
          {job.started_at && job.completed_at && (
            <div>
              <p className="text-muted-foreground text-xs">Duration</p>
              <p className="font-medium font-mono">
                {(
                  (new Date(job.completed_at).getTime() -
                    new Date(job.started_at).getTime()) /
                  1000
                ).toFixed(2)}
                s
              </p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs overflow-x-auto">
            <TimelineStep
              label="Created"
              time={job.created_at}
              active
              color="bg-zinc-500"
            />
            <TimelineArrow />
            <TimelineStep
              label="Started"
              time={job.started_at}
              active={!!job.started_at}
              color="bg-blue-500"
            />
            <TimelineArrow />
            {job.status === "failed" ? (
              <TimelineStep
                label="Failed"
                time={job.completed_at}
                active={!!job.completed_at}
                color="bg-red-500"
              />
            ) : (
              <TimelineStep
                label="Completed"
                time={job.completed_at}
                active={!!job.completed_at}
                color="bg-green-500"
              />
            )}
          </div>
        </div>

        {job.error && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-900/50 rounded text-sm text-red-400">
            <p className="font-medium text-xs mb-1">Error</p>
            <p className="font-mono text-xs">{job.error}</p>
          </div>
        )}
      </div>

      {/* Loading states */}
      {job.status === "queued" && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="text-3xl mb-2 opacity-30">&#9203;</div>
          <p className="text-muted-foreground">
            Job is queued, waiting for a worker to pick it up...
          </p>
        </div>
      )}

      {job.status === "running" && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-blue-400">Scraping in progress...</p>
        </div>
      )}

      {/* Results */}
      {job.results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Results ({job.results.length})
          </h2>

          {/* Tab bar for all results */}
          <div className="flex border-b border-border mb-2">
            {(
              [
                { key: "markdown" as Tab, label: "Markdown" },
                { key: "metadata" as Tab, label: "Metadata" },
                { key: "raw" as Tab, label: "Raw" },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {job.results.map((result, idx) => (
            <div
              key={idx}
              className="border border-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedResult(expandedResult === idx ? null : idx)
                }
                className="w-full text-left p-3 bg-card hover:bg-accent/50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <span className="text-sm text-primary truncate">
                    {result.url}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {result.metadata.title && (
                    <span className="truncate max-w-48 hidden sm:inline">
                      {result.metadata.title}
                    </span>
                  )}
                  <span>{result.metadata.word_count} words</span>
                  <span>{result.metadata.response_time_ms}ms</span>
                  {result.metadata.used_proxy && (
                    <span className="text-warning">proxy</span>
                  )}
                  <span>{expandedResult === idx ? "\u25B2" : "\u25BC"}</span>
                </div>
              </button>

              {expandedResult === idx && (
                <div className="border-t border-border">
                  {activeTab === "markdown" && (
                    <div className="p-4">
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(result.markdown)
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          Copy Markdown
                        </button>
                      </div>
                      <div className="max-h-[600px] overflow-y-auto">
                        <MarkdownViewer content={result.markdown} />
                      </div>
                    </div>
                  )}

                  {activeTab === "metadata" && (
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <MetaItem label="Title" value={result.metadata.title} />
                      <MetaItem
                        label="Description"
                        value={result.metadata.description}
                      />
                      <MetaItem
                        label="Language"
                        value={result.metadata.language}
                      />
                      <MetaItem
                        label="Canonical"
                        value={result.metadata.canonical_url}
                      />
                      <MetaItem
                        label="OG Image"
                        value={result.metadata.og_image}
                      />
                      <MetaItem
                        label="Favicon"
                        value={result.metadata.favicon}
                      />
                      <MetaItem
                        label="Words"
                        value={String(result.metadata.word_count)}
                      />
                      <MetaItem
                        label="Internal Links"
                        value={String(result.metadata.links_internal)}
                      />
                      <MetaItem
                        label="External Links"
                        value={String(result.metadata.links_external)}
                      />
                      <MetaItem
                        label="Images"
                        value={String(result.metadata.images_count)}
                      />
                      <MetaItem
                        label="Response Time"
                        value={`${result.metadata.response_time_ms}ms`}
                      />
                      <MetaItem
                        label="Used Proxy"
                        value={result.metadata.used_proxy ? "Yes" : "No"}
                      />
                      <MetaItem
                        label="Crawled At"
                        value={result.metadata.crawled_at}
                      />
                      {result.metadata.headings.length > 0 && (
                        <div className="col-span-full bg-background rounded-md p-2.5 border border-border">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Headings ({result.metadata.headings.length})
                          </p>
                          <ul className="space-y-0.5">
                            {result.metadata.headings.map((h, i) => (
                              <li
                                key={i}
                                className="text-xs text-muted-foreground"
                              >
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "raw" && (
                    <div className="p-4">
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(result.markdown)
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-muted-foreground bg-background p-3 rounded-md max-h-[600px] overflow-auto whitespace-pre-wrap break-words">
                        {result.markdown}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineStep({
  label,
  time,
  active,
  color,
}: {
  label: string;
  time: string | null;
  active: boolean;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2.5 h-2.5 rounded-full ${active ? color : "bg-border"}`}
      />
      <div>
        <span className={active ? "text-foreground" : "text-muted-foreground"}>
          {label}
        </span>
        {time && (
          <span className="text-muted-foreground ml-1">
            {new Date(time).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

function TimelineArrow() {
  return (
    <div className="w-8 h-px bg-border" />
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="bg-background rounded-md p-2.5 border border-border">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm break-all mt-0.5">{value}</p>
    </div>
  );
}
