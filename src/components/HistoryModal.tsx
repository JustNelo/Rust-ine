import { memo, useCallback } from "react";
import { X, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useHistory } from "../hooks/useHistory";
import { useT } from "../i18n/i18n";

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface HistoryModalProps {
  onClose: () => void;
}

export const HistoryModal = memo(function HistoryModal({ onClose }: HistoryModalProps) {
  const { t } = useT();
  const { entries, clearHistory } = useHistory();

  const handleClear = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden border border-black/12 dark:border-white/8 bg-white/90 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/12 dark:border-white/8">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              {t("history.title")}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
              ({entries.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                onClick={handleClear}
                className="btn-ghost-danger"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                {t("history.clear")}
              </button>
            )}
            <button
              onClick={onClose}
              className="btn-icon"
            >
              <X className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-8">
              {t("history.empty")}
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/6 bg-black/4 dark:bg-white/2 px-3 py-2 hover:bg-black/6 dark:hover:bg-white/4 transition-colors duration-200"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  {entry.failCount === 0 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                  ) : entry.successCount === 0 ? (
                    <XCircle className="h-3.5 w-3.5 text-red-400" strokeWidth={1.5} />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-900 dark:text-white">
                      {t(`tab.${entry.tabId.replace("-", "_")}` as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {entry.successCount}/{entry.filesCount} {t("history.succeeded")}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-600 truncate">
                    {entry.outputDir}
                  </p>
                </div>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 shrink-0">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
