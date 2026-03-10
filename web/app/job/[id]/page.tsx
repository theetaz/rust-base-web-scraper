"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useJob, useDeleteJob } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Copy,
  Loader2,
  Clock,
  ExternalLink,
} from "lucide-react";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: job, isLoading, error } = useJob(id);
  const deleteJob = useDeleteJob();
  const [expandedResult, setExpandedResult] = useState<number | null>(0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
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
    try {
      await deleteJob.mutateAsync(id);
      toast.success("Job deleted");
      router.push("/");
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Job Detail</h1>
        <StatusBadge status={job.status} />
        <span className="text-xs font-mono text-muted-foreground ml-auto hidden sm:inline">
          {job.task_id}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this job?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this job and all its results. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Job info card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">URL</p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all text-sm inline-flex items-center gap-1"
              >
                {job.url}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Mode</p>
              <Badge variant="secondary">{job.mode}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Pages Crawled</p>
              <p className="font-medium">{job.pages_crawled}</p>
            </div>
            {job.started_at && job.completed_at && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Duration</p>
                <p className="font-medium font-mono">
                  {((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(2)}s
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <Separator className="my-4" />
          <div className="flex items-center gap-2 text-xs overflow-x-auto">
            <TimelineStep label="Created" time={job.created_at} active color="bg-muted-foreground" />
            <div className="w-8 h-px bg-border" />
            <TimelineStep label="Started" time={job.started_at} active={!!job.started_at} color="bg-primary" />
            <div className="w-8 h-px bg-border" />
            {job.status === "failed" ? (
              <TimelineStep label="Failed" time={job.completed_at} active={!!job.completed_at} color="bg-destructive" />
            ) : (
              <TimelineStep label="Completed" time={job.completed_at} active={!!job.completed_at} color="bg-success" />
            )}
          </div>

          {job.error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              <p className="font-medium text-xs mb-1">Error</p>
              <p className="font-mono text-xs">{job.error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading states */}
      {job.status === "queued" && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="size-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              Job is queued, waiting for a worker to pick it up...
            </p>
          </CardContent>
        </Card>
      )}

      {job.status === "running" && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="size-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-primary">Scraping in progress...</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {job.results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Results ({job.results.length})</h2>

          {job.results.map((result, idx) => (
            <Card key={idx}>
              <button
                onClick={() => setExpandedResult(expandedResult === idx ? null : idx)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-xl"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-xs shrink-0">#{idx + 1}</Badge>
                  <span className="text-sm text-primary truncate">{result.url}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {result.metadata.title && (
                    <span className="truncate max-w-48 hidden sm:inline">{result.metadata.title}</span>
                  )}
                  <Badge variant="secondary" className="text-xs">{result.metadata.word_count} words</Badge>
                  <span>{result.metadata.response_time_ms}ms</span>
                  {result.metadata.used_proxy && <Badge variant="warning" className="text-xs">proxy</Badge>}
                  <span className="text-muted-foreground">{expandedResult === idx ? "\u25B2" : "\u25BC"}</span>
                </div>
              </button>

              {expandedResult === idx && (
                <>
                  <Separator />
                  <CardContent className="p-0">
                    <Tabs defaultValue="markdown">
                      <TabsList className="m-4 mb-0">
                        <TabsTrigger value="markdown">Markdown</TabsTrigger>
                        <TabsTrigger value="metadata">Metadata</TabsTrigger>
                        <TabsTrigger value="raw">Raw</TabsTrigger>
                      </TabsList>

                      <TabsContent value="markdown" className="p-4">
                        <div className="flex justify-end mb-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(result.markdown)}
                              >
                                <Copy className="size-3.5" />
                                Copy
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy markdown</TooltipContent>
                          </Tooltip>
                        </div>
                        <ScrollArea className="max-h-[600px]">
                          <MarkdownViewer content={result.markdown} />
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="metadata" className="p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          <MetaItem label="Title" value={result.metadata.title} />
                          <MetaItem label="Description" value={result.metadata.description} />
                          <MetaItem label="Language" value={result.metadata.language} />
                          <MetaItem label="Canonical" value={result.metadata.canonical_url} />
                          <MetaItem label="OG Image" value={result.metadata.og_image} />
                          <MetaItem label="Favicon" value={result.metadata.favicon} />
                          <MetaItem label="Words" value={String(result.metadata.word_count)} />
                          <MetaItem label="Internal Links" value={String(result.metadata.links_internal)} />
                          <MetaItem label="External Links" value={String(result.metadata.links_external)} />
                          <MetaItem label="Images" value={String(result.metadata.images_count)} />
                          <MetaItem label="Response Time" value={`${result.metadata.response_time_ms}ms`} />
                          <MetaItem label="Used Proxy" value={result.metadata.used_proxy ? "Yes" : "No"} />
                          <MetaItem label="Crawled At" value={result.metadata.crawled_at} />
                          {result.metadata.headings.length > 0 && (
                            <Card className="col-span-full">
                              <CardContent className="p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                  Headings ({result.metadata.headings.length})
                                </p>
                                <ul className="space-y-0.5">
                                  {result.metadata.headings.map((h, i) => (
                                    <li key={i} className="text-xs text-muted-foreground">{h}</li>
                                  ))}
                                </ul>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="raw" className="p-4">
                        <div className="flex justify-end mb-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.markdown)}
                          >
                            <Copy className="size-3.5" />
                            Copy
                          </Button>
                        </div>
                        <ScrollArea className="max-h-[600px]">
                          <pre className="text-xs font-mono text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap break-words">
                            {result.markdown}
                          </pre>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </>
              )}
            </Card>
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
      <div className={`w-2.5 h-2.5 rounded-full ${active ? color : "bg-border"}`} />
      <div>
        <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        {time && (
          <span className="text-muted-foreground ml-1">
            {new Date(time).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm break-all mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}
