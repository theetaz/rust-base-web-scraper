"use client";

import { useState } from "react";
import { useSystemInfo, useHealth } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

export default function SystemPage() {
  const { data: system, isLoading } = useSystemInfo();
  const { data: health } = useHealth();

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Health monitoring, configuration, and debugging tools
        </p>
      </div>

      {/* Health status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthCard
          label="Overall"
          status={health?.status ?? "unknown"}
        />
        <HealthCard
          label="Redis"
          status={health?.redis ?? "unknown"}
        />
        <HealthCard
          label="SQLite"
          status={health?.sqlite ?? "unknown"}
        />
      </div>

      {/* Configuration */}
      {system?.config && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium">Configuration</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ConfigItem label="Port" value={String(system.config.port)} />
              <ConfigItem
                label="Max Workers"
                value={String(system.config.max_workers)}
              />
              <ConfigItem
                label="Proxy"
                value={
                  system.config.proxy_configured
                    ? `Configured (${system.config.proxy_mode})`
                    : "Not configured"
                }
                warn={!system.config.proxy_configured}
              />
              <ConfigItem
                label="Database"
                value={system.config.database_url}
                mono
              />
              <ConfigItem
                label="Redis"
                value={system.config.redis_url}
                mono
              />
            </div>
          </div>
        </div>
      )}

      {/* API Tester */}
      <ApiTester />

      {/* Recent errors */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent Errors</h2>
          <span className="text-xs text-muted-foreground">
            {system?.recent_errors?.length ?? 0} failed jobs
          </span>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {(system?.recent_errors ?? []).length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No errors - all clear!
            </div>
          )}
          {(system?.recent_errors ?? []).map((job) => (
            <div key={job.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                <Link
                  href={`/job/${job.id}`}
                  className="text-sm text-primary hover:underline truncate"
                >
                  {job.url}
                </Link>
                <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
                  {job.completed_at
                    ? new Date(job.completed_at).toLocaleString()
                    : ""}
                </span>
              </div>
              {job.error && (
                <p className="text-xs text-red-400 font-mono bg-red-900/10 rounded p-2">
                  {job.error}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthCard({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  const isOk = status === "ok" || status === "connected";
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full ${isOk ? "bg-green-500" : "bg-red-500"} ${isOk ? "" : "animate-pulse"}`}
      />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${isOk ? "text-green-400" : "text-red-400"}`}>
          {status}
        </p>
      </div>
    </div>
  );
}

function ConfigItem({
  label,
  value,
  mono,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-background rounded-md p-2.5 border border-border">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm mt-0.5 ${mono ? "font-mono" : ""} ${warn ? "text-warning" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function ApiTester() {
  const [selectedEndpoint, setSelectedEndpoint] = useState("/api/health");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const endpoints = [
    { path: "/api/health", method: "GET", label: "Health Check" },
    { path: "/api/stats", method: "GET", label: "Stats" },
    { path: "/api/queue/status", method: "GET", label: "Queue Status" },
    { path: "/api/system", method: "GET", label: "System Info" },
    { path: "/api/scrape", method: "GET", label: "List Jobs" },
    {
      path: "/api/scrape",
      method: "POST",
      label: "Submit Job",
      defaultBody: JSON.stringify(
        { url: "https://example.com", mode: "scrape", limit: 1, wait_seconds: 3 },
        null,
        2,
      ),
    },
  ];

  const handleTest = async () => {
    setLoading(true);
    setResponse(null);
    setResponseStatus(null);
    setElapsed(null);
    const start = performance.now();
    try {
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (method === "POST" && body.trim()) {
        opts.body = body;
      }
      const res = await fetch(selectedEndpoint, opts);
      const end = performance.now();
      setElapsed(Math.round(end - start));
      setResponseStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err) {
      const end = performance.now();
      setElapsed(Math.round(end - start));
      setResponse(String(err));
      setResponseStatus(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium">API Tester</h2>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {endpoints.map((ep) => (
            <button
              key={`${ep.method}-${ep.path}`}
              onClick={() => {
                setSelectedEndpoint(ep.path);
                setMethod(ep.method);
                setBody(ep.defaultBody ?? "");
                setResponse(null);
                setResponseStatus(null);
              }}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                selectedEndpoint === ep.path && method === ep.method
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-mono mr-1 opacity-60">{ep.method}</span>
              {ep.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-background border border-border rounded px-2 py-1.5 text-muted-foreground">
            {method}
          </span>
          <input
            type="text"
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleTest}
            disabled={loading}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>

        {method === "POST" && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Request body (JSON)"
            rows={4}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {response !== null && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`font-mono font-bold ${
                  responseStatus && responseStatus >= 200 && responseStatus < 300
                    ? "text-green-400"
                    : responseStatus && responseStatus >= 400
                      ? "text-red-400"
                      : "text-warning"
                }`}
              >
                {responseStatus}
              </span>
              {elapsed != null && (
                <span className="text-muted-foreground">{elapsed}ms</span>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(response)}
                className="text-primary hover:underline ml-auto"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs font-mono text-muted-foreground bg-background p-3 rounded-md max-h-80 overflow-auto whitespace-pre-wrap">
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
