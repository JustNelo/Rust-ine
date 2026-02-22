import { useProcessingProgress } from "../hooks/useProcessingProgress";

export function GlobalProgressBar() {
  const { progress } = useProcessingProgress();

  if (!progress || progress.completed >= progress.total) return null;

  const percent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-glass-border px-4 py-2.5 min-w-72"
      style={{
        background: "rgba(108,108,237,0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 0 30px rgba(108,108,237,0.1), 0 0 60px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary font-medium">
            Processing {progress.completed}/{progress.total}
          </span>
          <span className="font-mono text-text-muted">{percent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-accent-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-accent to-[#8B8BF5] transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
