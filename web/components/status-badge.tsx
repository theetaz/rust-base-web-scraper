import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
    className?: string;
  }
> = {
  queued: { variant: "secondary" },
  running: { variant: "default", className: "animate-pulse" },
  completed: { variant: "success" },
  failed: { variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={cn("text-xs", config.className)}>
      {status}
    </Badge>
  );
}
