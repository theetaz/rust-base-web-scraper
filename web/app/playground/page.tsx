"use client";

import { useState } from "react";
import { useSubmitJob, useJob } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { MarkdownViewer } from "@/components/markdown-viewer";

type Tab = "markdown" | "metadata" | "raw" | "headings";

export default function PlaygroundPage() {
  const submitJob = useSubmitJob();

  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("scrape");
  const [limit, setLimit] = useState(10);
  const [waitSeconds, setWaitSeconds] = useState(3);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("markdown");
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [history, setHistory] = useState<
    { id: string; url: string; status: string }[]
  >([]);

  const {
    data: job,
    isLoading: jobLoading,
  } = useJob(activeJobId ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await submitJob.mutateAsync({
        url,
        mode,
        limit,
        wait_seconds: waitSeconds,
      });
      setActiveJobId(result.task_id);
      setActiveResultIdx(0);
      setActiveTab("markdown");
      setHistory((h) => [
        { id: result.task_id, url, status: "queued" },
        ...h,
      ]);
    } catch {
      // error shown inline
    }
  };

  // Update history status
  if (job && history.length > 0 && history[0].id === job.task_id) {
    if (history[0].status !== job.status) {
      history[0].status = job.status;
    }
  }

  const currentResult = job?.results?.[activeResultIdx];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Playground</h1>
      <p className="text-sm text-muted-foreground">
        Test scrape any URL and see results instantly. Runs a real job through
        the queue.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left panel: Input + History */}
        <div className="lg:col-span-4 space-y-4">
          {/* Input form */}
          <div className="bg-card border border-border rounded-lg p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  required
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mode
                </label>
                <div className="flex gap-1">
                  {(["scrape", "crawl", "http"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 px-2 py-1.5 rounded text-xs border transition-colors ${
                        mode === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {mode !== "scrape" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Limit: {limit}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}
                {mode !== "http" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Wait: {waitSeconds}s
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      value={waitSeconds}
                      onChange={(e) => setWaitSeconds(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                )}
              </div>

              {submitJob.error && (
                <p className="text-destructive text-xs">
                  {(submitJob.error as Error).message}
                </p>
              )}

              <button
                type="submit"
                disabled={submitJob.isPending}
                className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitJob.isPending ? "Submitting..." : "Run Scrape"}
              </button>
            </form>
          </div>

          {/* Session history */}
          {history.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">
                Session History
              </h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setActiveJobId(h.id);
                      setActiveResultIdx(0);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                      activeJobId === h.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <StatusBadge status={h.status} />
                    <span className="truncate text-muted-foreground flex-1">
                      {h.url}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Results */}
        <div className="lg:col-span-8">
          {!activeJobId && (
            <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
              <div className="text-4xl mb-3 opacity-30">&#128375;</div>
              <p>Enter a URL and hit Run Scrape to see results here</p>
            </div>
          )}

          {activeJobId && jobLoading && (
            <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
              Loading...
            </div>
          )}

          {activeJobId && job && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={job.status} />
                  <span className="text-sm text-muted-foreground">
                    {job.url}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {job.pages_crawled > 0 && (
                    <span>{job.pages_crawled} page(s)</span>
                  )}
                  {job.started_at && job.completed_at && (
                    <span>
                      {(
                        (new Date(job.completed_at).getTime() -
                          new Date(job.started_at).getTime()) /
                        1000
                      ).toFixed(1)}
                      s total
                    </span>
                  )}
                  <span className="text-[10px] font-mono opacity-50">
                    {job.task_id.slice(0, 8)}
                  </span>
                </div>
              </div>

              {/* Loading states */}
              {(job.status === "queued" || job.status === "running") && (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {job.status === "queued"
                      ? "Waiting for worker..."
                      : "Scraping page..."}
                  </p>
                </div>
              )}

              {/* Error */}
              {job.status === "failed" && job.error && (
                <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-4 text-sm text-red-400">
                  <p className="font-medium mb-1">Scrape Failed</p>
                  <p className="font-mono text-xs">{job.error}</p>
                </div>
              )}

              {/* Results */}
              {job.results.length > 0 && (
                <>
                  {/* Page selector for multi-page results */}
                  {job.results.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {job.results.map((r, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveResultIdx(idx)}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            activeResultIdx === idx
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Page {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {currentResult && (
                    <>
                      {/* Tabs */}
                      <div className="flex border-b border-border">
                        {(
                          [
                            { key: "markdown", label: "Markdown" },
                            { key: "metadata", label: "Metadata" },
                            { key: "headings", label: "Headings" },
                            { key: "raw", label: "Raw" },
                          ] as { key: Tab; label: string }[]
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

                      {/* Tab content */}
                      <div className="bg-card border border-border rounded-lg">
                        {activeTab === "markdown" && (
                          <div className="p-4">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs text-muted-foreground">
                                {currentResult.metadata.word_count} words |{" "}
                                {currentResult.metadata.response_time_ms}ms
                                {currentResult.metadata.used_proxy &&
                                  " | via proxy"}
                              </span>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    currentResult.markdown,
                                  )
                                }
                                className="text-xs text-primary hover:underline"
                              >
                                Copy Markdown
                              </button>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto">
                              <MarkdownViewer
                                content={currentResult.markdown}
                              />
                            </div>
                          </div>
                        )}

                        {activeTab === "metadata" && (
                          <div className="p-4">
                            <MetadataGrid
                              metadata={currentResult.metadata}
                              url={currentResult.url}
                            />
                          </div>
                        )}

                        {activeTab === "headings" && (
                          <div className="p-4">
                            {currentResult.metadata.headings.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No headings found
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {currentResult.metadata.headings.map(
                                  (h, i) => (
                                    <li
                                      key={i}
                                      className="text-sm text-muted-foreground font-mono"
                                    >
                                      {h}
                                    </li>
                                  ),
                                )}
                              </ul>
                            )}
                          </div>
                        )}

                        {activeTab === "raw" && (
                          <div className="p-4">
                            <div className="flex justify-end mb-2">
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    currentResult.markdown,
                                  )
                                }
                                className="text-xs text-primary hover:underline"
                              >
                                Copy
                              </button>
                            </div>
                            <pre className="text-xs font-mono text-muted-foreground bg-background p-3 rounded-md max-h-[600px] overflow-auto whitespace-pre-wrap break-words">
                              {currentResult.markdown}
                            </pre>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetadataGrid({
  metadata,
  url,
}: {
  metadata: import("@/lib/api").ResultMetadata;
  url: string;
}) {
  const items: { label: string; value: string | number | boolean | null }[] = [
    { label: "URL", value: url },
    { label: "Title", value: metadata.title },
    { label: "Description", value: metadata.description },
    { label: "Language", value: metadata.language },
    { label: "Canonical URL", value: metadata.canonical_url },
    { label: "OG Image", value: metadata.og_image },
    { label: "Favicon", value: metadata.favicon },
    { label: "Word Count", value: metadata.word_count },
    { label: "Internal Links", value: metadata.links_internal },
    { label: "External Links", value: metadata.links_external },
    { label: "Images", value: metadata.images_count },
    { label: "Response Time", value: `${metadata.response_time_ms}ms` },
    { label: "Used Proxy", value: metadata.used_proxy ? "Yes" : "No" },
    { label: "Crawled At", value: metadata.crawled_at },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(
        (item) =>
          item.value != null &&
          item.value !== "" && (
            <div
              key={item.label}
              className="bg-background rounded-md p-2.5 border border-border"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                {item.label}
              </p>
              <p className="text-sm break-all">{String(item.value)}</p>
            </div>
          ),
      )}
    </div>
  );
}
