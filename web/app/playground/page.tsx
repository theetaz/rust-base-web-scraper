"use client";

import { useState, useEffect } from "react";
import { useSubmitJob, useJob } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader2, Copy, FlaskConical } from "lucide-react";
import type { ResultMetadata } from "@/lib/api";

export default function PlaygroundPage() {
  const submitJob = useSubmitJob();

  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("scrape");
  const [limit, setLimit] = useState(10);
  const [waitSeconds, setWaitSeconds] = useState(3);
  const [mainContent, setMainContent] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [history, setHistory] = useState<
    { id: string; url: string; status: string }[]
  >([]);

  const { data: job, isLoading: jobLoading } = useJob(activeJobId ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await submitJob.mutateAsync({
        url,
        mode,
        limit,
        wait_seconds: waitSeconds,
        main_content: mainContent,
      });
      setActiveJobId(result.task_id);
      setActiveResultIdx(0);
      setHistory((h) => [
        { id: result.task_id, url, status: "queued" },
        ...h,
      ]);
      toast.success("Job submitted");
    } catch (err) {
      toast.error(`Submit failed: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    if (job && history.length > 0 && history[0].id === job.task_id && history[0].status !== job.status) {
      setHistory((h) => [{ ...h[0], status: job.status }, ...h.slice(1)]);
    }
  }, [job?.status, job?.task_id, history]);

  const currentResult = job?.results?.[activeResultIdx];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Playground</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test scrape any URL and see results instantly. Runs a real job through
          the queue.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pg-url" className="text-xs">
                    URL
                  </Label>
                  <Input
                    id="pg-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Mode</Label>
                  <div className="flex gap-1">
                    {(["scrape", "crawl", "http"] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={mode === m ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMode(m)}
                        className="flex-1 text-xs"
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {mode !== "scrape" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Limit: {limit}</Label>
                      <Slider
                        value={[limit]}
                        onValueChange={([v]) => setLimit(v)}
                        min={1}
                        max={50}
                        step={1}
                      />
                    </div>
                  )}
                  {mode !== "http" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Wait: {waitSeconds}s</Label>
                      <Slider
                        value={[waitSeconds]}
                        onValueChange={([v]) => setWaitSeconds(v)}
                        min={1}
                        max={15}
                        step={1}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Main Content Only</Label>
                  <Switch
                    checked={mainContent}
                    onCheckedChange={setMainContent}
                  />
                </div>

                {submitJob.error && (
                  <p className="text-destructive text-xs">
                    {(submitJob.error as Error).message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitJob.isPending}
                  className="w-full"
                >
                  {submitJob.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Run Scrape"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs text-muted-foreground">
                  Session History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ScrollArea className="max-h-64">
                  <div className="space-y-1">
                    {history.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setActiveJobId(h.id);
                          setActiveResultIdx(0);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${activeJobId === h.id
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
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-8">
          {!activeJobId && (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <FlaskConical className="size-10 mx-auto mb-3 opacity-30" />
                <p>Enter a URL and hit Run Scrape to see results here</p>
              </CardContent>
            </Card>
          )}

          {activeJobId && jobLoading && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          )}

          {activeJobId && job && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <span className="text-sm text-muted-foreground truncate">
                      {job.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {job.pages_crawled > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {job.pages_crawled} page(s)
                      </Badge>
                    )}
                    {job.started_at && job.completed_at && (
                      <span>
                        {(
                          (new Date(job.completed_at).getTime() -
                            new Date(job.started_at).getTime()) /
                          1000
                        ).toFixed(1)}
                        s
                      </span>
                    )}
                    <span className="text-[10px] font-mono opacity-50">
                      {job.task_id.slice(0, 8)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {(job.status === "queued" || job.status === "running") && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Loader2 className="size-6 text-primary mx-auto mb-3 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      {job.status === "queued"
                        ? "Waiting for worker..."
                        : "Scraping page..."}
                    </p>
                  </CardContent>
                </Card>
              )}

              {job.status === "failed" && job.error && (
                <Card className="border-destructive/30">
                  <CardContent className="p-4">
                    <p className="font-medium mb-1 text-destructive text-sm">
                      Scrape Failed
                    </p>
                    <p className="font-mono text-xs text-destructive/80">
                      {job.error}
                    </p>
                  </CardContent>
                </Card>
              )}

              {job.results.length > 0 && (
                <>
                  {job.results.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {job.results.map((_, idx) => (
                        <Button
                          key={idx}
                          variant={activeResultIdx === idx ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveResultIdx(idx)}
                          className="text-xs"
                        >
                          Page {idx + 1}
                        </Button>
                      ))}
                    </div>
                  )}

                  {currentResult && (
                    <Card>
                      <CardContent className="p-0">
                        <Tabs defaultValue="markdown">
                          <TabsList className="m-4 mb-0">
                            <TabsTrigger value="markdown">Markdown</TabsTrigger>
                            <TabsTrigger value="metadata">Metadata</TabsTrigger>
                            <TabsTrigger value="headings">Headings</TabsTrigger>
                            <TabsTrigger value="raw">Raw</TabsTrigger>
                          </TabsList>

                          <TabsContent value="markdown" className="p-4">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs text-muted-foreground">
                                {currentResult.metadata.word_count} words |{" "}
                                {currentResult.metadata.response_time_ms}ms
                                {currentResult.metadata.used_proxy && " | via proxy"}
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyToClipboard(currentResult.markdown)
                                    }
                                  >
                                    <Copy className="size-3.5" />
                                    Copy
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy markdown</TooltipContent>
                              </Tooltip>
                            </div>
                            <ScrollArea className="max-h-[600px]">
                              <MarkdownViewer content={currentResult.markdown} />
                            </ScrollArea>
                          </TabsContent>

                          <TabsContent value="metadata" className="p-4">
                            <MetadataGrid
                              metadata={currentResult.metadata}
                              url={currentResult.url}
                            />
                          </TabsContent>

                          <TabsContent value="headings" className="p-4">
                            {currentResult.metadata.headings.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No headings found
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {currentResult.metadata.headings.map((h, i) => (
                                  <li
                                    key={i}
                                    className="text-sm text-muted-foreground font-mono"
                                  >
                                    {h}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TabsContent>

                          <TabsContent value="raw" className="p-4">
                            <div className="flex justify-end mb-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(currentResult.markdown)
                                }
                              >
                                <Copy className="size-3.5" />
                                Copy
                              </Button>
                            </div>
                            <ScrollArea className="max-h-[600px]">
                              <pre className="text-xs font-mono text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap break-words">
                                {currentResult.markdown}
                              </pre>
                            </ScrollArea>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
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
}: { metadata: ResultMetadata; url: string }) {
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
            <Card key={item.label}>
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  {item.label}
                </p>
                <p className="text-sm break-all">{String(item.value)}</p>
              </CardContent>
            </Card>
          )
      )}
    </div>
  );
}
