export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-zinc-700 text-zinc-300",
    running: "bg-blue-900/50 text-blue-400 animate-pulse",
    completed: "bg-green-900/50 text-green-400",
    failed: "bg-red-900/50 text-red-400",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || "bg-zinc-700 text-zinc-300"}`}
    >
      {status}
    </span>
  );
}
