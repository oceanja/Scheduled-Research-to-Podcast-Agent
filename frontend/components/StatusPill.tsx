type Status = "pending" | "generating" | "ready" | "failed";

const styles: Record<
  Status,
  { pill: string; dot: string; animate: boolean }
> = {
  pending: {
    pill: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    dot: "bg-zinc-400",
    animate: false,
  },
  generating: {
    pill: "bg-amber-50 text-amber-900 ring-amber-200",
    dot: "bg-amber-500",
    animate: true,
  },
  ready: {
    pill: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    dot: "bg-emerald-500",
    animate: false,
  },
  failed: {
    pill: "bg-red-50 text-red-800 ring-red-200",
    dot: "bg-red-500",
    animate: false,
  },
};

const labels: Record<Status, string> = {
  pending: "Queued",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

export function StatusPill({ status }: { status: Status }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${s.pill}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${s.dot} ${
          s.animate ? "animate-pulse-dot" : ""
        }`}
      />
      {labels[status]}
    </span>
  );
}
