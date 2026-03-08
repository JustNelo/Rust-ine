import { useCallback } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useProcessingProgress } from "../hooks/useProcessingProgress";
import { useT } from "../i18n/i18n";

export function GlobalProgressBar() {
  const { t } = useT();
  const { progress } = useProcessingProgress();

  const handleCancel = useCallback(async () => {
    try {
      await invoke("cancel_processing");
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  }, []);

  if (!progress || progress.completed >= progress.total) return null;

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 min-w-72"
      style={{ borderRadius: 12, border: '1px solid var(--bg-border)', background: 'var(--bg-surface)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t("status.processing", { completed: progress.completed, total: progress.total })}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{percent}%</span>
        </div>
        {progress.current_file && (
          <p className="truncate max-w-56" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{progress.current_file}</p>
        )}
        <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 3, background: 'var(--bg-border)' }}>
          <div
            style={{ height: '100%', borderRadius: 3, background: 'var(--indigo-core)', width: `${percent}%`, transition: 'width 300ms ease' }}
          />
        </div>
      </div>
      <button
        onClick={handleCancel}
        data-cancel-button
        className="btn-icon"
        title={t("action.cancel")}
        style={{ color: 'var(--text-tertiary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
