"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSubmitJob } from "@/lib/api";

export function NewJobForm() {
  const router = useRouter();
  const submitJob = useSubmitJob();

  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("scrape");
  const [limit, setLimit] = useState(10);
  const [waitSeconds, setWaitSeconds] = useState(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await submitJob.mutateAsync({
        url,
        mode,
        limit,
        wait_seconds: waitSeconds,
      });
      router.push(`/job/${result.task_id}`);
    } catch {
      // error is available via submitJob.error
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Mode</label>
        <div className="flex gap-2">
          {["scrape", "crawl", "http"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "scrape"
                ? "Scrape (single page)"
                : m === "crawl"
                  ? "Crawl (follow links)"
                  : "HTTP (no browser)"}
            </button>
          ))}
        </div>
      </div>

      {mode !== "scrape" && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Page Limit: {limit}
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      )}

      {mode !== "http" && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Wait Time: {waitSeconds}s
          </label>
          <input
            type="range"
            min={1}
            max={15}
            value={waitSeconds}
            onChange={(e) => setWaitSeconds(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Extra wait for JS rendering
          </p>
        </div>
      )}

      {submitJob.error && (
        <p className="text-destructive text-sm">
          {(submitJob.error as Error).message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitJob.isPending}
        className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitJob.isPending ? "Submitting..." : "Start Scrape"}
      </button>
    </form>
  );
}
