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
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        style={{
          borderRadius: 12,
          border: "1px solid var(--bg-border)",
          background: "var(--bg-elevated)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--bg-border)" }}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} strokeWidth={1.5} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>
              {t("history.title")}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>({entries.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button onClick={handleClear} className="btn-ghost-danger">
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                {t("history.clear")}
              </button>
            )}
            <button onClick={onClose} className="btn-icon">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-center py-8" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              {t("history.empty")}
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 cursor-default"
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--bg-border)",
                  background: "var(--bg-overlay)",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-border)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-overlay)";
                }}
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  {entry.failCount === 0 ? (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--success)" }} strokeWidth={1.5} />
                  ) : entry.successCount === 0 ? (
                    <XCircle className="h-3.5 w-3.5" style={{ color: "var(--danger)" }} strokeWidth={1.5} />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--warning)" }} strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>
                      {t(`tab.${entry.tabId.replace("-", "_")}` as Parameters<typeof t>[0])}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      {entry.successCount}/{entry.filesCount} {t("history.succeeded")}
                    </span>
                  </div>
                  <p className="truncate" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {entry.outputDir}
                  </p>
                </div>
                <span className="shrink-0" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
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
