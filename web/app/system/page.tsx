"use client";

import { useState } from "react";
import { useSystemInfo, useHealth, useCleanupStorage } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, Send, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SystemPage() {
  const { data: system, isLoading } = useSystemInfo();
  const { data: health } = useHealth();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">System</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Health monitoring, configuration, and debugging tools
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthCard label="Overall" status={health?.status ?? "unknown"} />
        <HealthCard label="Redis" status={health?.redis ?? "unknown"} />
        <HealthCard label="SQLite" status={health?.sqlite ?? "unknown"} />
      </div>

      {system?.config && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
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
              <ConfigItem label="Redis" value={system.config.redis_url} mono />
            </div>
          </CardContent>
        </Card>
      )}

      <StorageCleanupCard />
      <ApiTester />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Recent Errors</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {system?.recent_errors?.length ?? 0} failed jobs
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border">
              {(system?.recent_errors ?? []).length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No errors - all clear!
                </div>
              )}
              {(system?.recent_errors ?? []).map((job) => (
                <div key={job.id} className="px-6 py-3 space-y-1">
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
                    <p className="text-xs text-destructive font-mono bg-destructive/10 rounded p-2">
                      {job.error}
                    </p>
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

function HealthCard({ label, status }: { label: string; status: string }) {
  const isOk = status === "ok" || status === "connected";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${isOk ? "bg-success" : "bg-destructive"} ${isOk ? "" : "animate-pulse"}`}
        />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={`text-sm font-medium ${isOk ? "text-success" : "text-destructive"}`}
          >
            {status}
          </p>
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-sm mt-0.5 ${mono ? "font-mono" : ""} ${warn ? "text-warning" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StorageCleanupCard() {
  const cleanup = useCleanupStorage();
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const runCleanup = async (mode: "orphaned" | "all") => {
    try {
      const res = await cleanup.mutateAsync({ mode });
      const mb = (res.freed_bytes / (1024 * 1024)).toFixed(2);
      toast.success(`Removed ${res.removed_count} dirs, freed ${mb} MB`);
      setConfirmAllOpen(false);
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Storage Cleanup</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runCleanup("orphaned")}
          disabled={cleanup.isPending}
        >
          {cleanup.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          Clean Orphaned
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmAllOpen(true)}
          disabled={cleanup.isPending}
        >
          Clean All
        </Button>
        <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clean all PDF images?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all PDF image directories. This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => runCleanup("all")}
              >
                Clean All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
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
    {
      path: "/api/cleanup?mode=orphaned",
      method: "POST",
      label: "Cleanup Storage",
    },
    { path: "/api/scrape", method: "GET", label: "List Jobs" },
    {
      path: "/api/scrape",
      method: "POST",
      label: "Submit Job",
      defaultBody: JSON.stringify(
        {
          url: "https://example.com",
          mode: "scrape",
          limit: 1,
          wait_seconds: 3,
        },
        null,
        2
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
      if (method === "POST" && body.trim()) opts.body = body;
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">API Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {endpoints.map((ep) => (
            <Button
              key={`${ep.method}-${ep.path}`}
              variant={
                selectedEndpoint === ep.path && method === ep.method
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => {
                setSelectedEndpoint(ep.path);
                setMethod(ep.method);
                setBody(ep.defaultBody ?? "");
                setResponse(null);
                setResponseStatus(null);
              }}
              className="text-xs"
            >
              <span className="font-mono mr-1 opacity-60">{ep.method}</span>
              {ep.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono shrink-0">
            {method}
          </Badge>
          <Input
            type="text"
            value={selectedEndpoint}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="font-mono text-sm"
          />
          <Button onClick={handleTest} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send
          </Button>
        </div>

        {method === "POST" && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Request body (JSON)"
            rows={4}
            className="w-full bg-transparent border border-input rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}

        {response !== null && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Badge
                variant={
                  responseStatus && responseStatus >= 200 && responseStatus < 300
                    ? "success"
                    : responseStatus && responseStatus >= 400
                      ? "destructive"
                      : "warning"
                }
                className="font-mono"
              >
                {responseStatus}
              </Badge>
              {elapsed != null && (
                <span className="text-muted-foreground">{elapsed}ms</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(response);
                  toast.success("Copied to clipboard");
                }}
                className="ml-auto"
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
            <ScrollArea className="max-h-80">
              <pre className="text-xs font-mono text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">
                {response}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
