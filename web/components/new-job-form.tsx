"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSubmitJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function NewJobForm() {
  const router = useRouter();
  const submitJob = useSubmitJob();

  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("scrape");
  const [limit, setLimit] = useState(10);
  const [waitSeconds, setWaitSeconds] = useState(3);
  const [mainContent, setMainContent] = useState(false);

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
      toast.success("Job submitted successfully");
      router.push(`/job/${result.task_id}`);
    } catch (err) {
      toast.error(`Failed to submit: ${(err as Error).message}`);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Configure Scrape</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              {(["scrape", "crawl", "http"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={mode === m ? "default" : "outline"}
                  onClick={() => setMode(m)}
                  className="flex-1"
                >
                  {m === "scrape"
                    ? "Scrape (single)"
                    : m === "crawl"
                      ? "Crawl (links)"
                      : "HTTP (no browser)"}
                </Button>
              ))}
            </div>
          </div>

          {mode !== "scrape" && (
            <div className="space-y-2">
              <Label>Page Limit: {limit}</Label>
              <Slider
                value={[limit]}
                onValueChange={([v]) => setLimit(v)}
                min={1}
                max={100}
                step={1}
              />
            </div>
          )}

          {mode !== "http" && (
            <div className="space-y-2">
              <Label>Wait Time: {waitSeconds}s</Label>
              <Slider
                value={[waitSeconds]}
                onValueChange={([v]) => setWaitSeconds(v)}
                min={1}
                max={15}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Extra wait for JS rendering
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="main-content">Main Content Only</Label>
              <p className="text-xs text-muted-foreground">
                Extract only the core article content
              </p>
            </div>
            <Switch
              id="main-content"
              checked={mainContent}
              onCheckedChange={setMainContent}
            />
          </div>

          {submitJob.error && (
            <p className="text-destructive text-sm">
              {(submitJob.error as Error).message}
            </p>
          )}

          <Button type="submit" disabled={submitJob.isPending} className="w-full">
            {submitJob.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Start Scrape"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
