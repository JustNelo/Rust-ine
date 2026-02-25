import { Download, X, Loader2, AlertCircle } from "lucide-react";
import { useT } from "../i18n/i18n";
import type { UpdateStatus } from "../hooks/useAutoUpdate";

interface UpdateBannerProps {
  status: UpdateStatus;
  version: string;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ status, version, onInstall, onDismiss }: UpdateBannerProps) {
  const { t } = useT();

  if (status !== "available" && status !== "downloading" && status !== "error") {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-glass-border px-4 py-2" style={{ background: 'rgba(108,108,237,0.06)' }}>
      <div className="flex items-center gap-2.5">
        {status === "downloading" ? (
          <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />
        ) : status === "error" ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        ) : (
          <Download className="h-3.5 w-3.5 text-accent shrink-0" />
        )}
        <span className="text-xs text-text-primary">
          {status === "downloading"
            ? t("updater.downloading")
            : status === "error"
              ? t("updater.error")
              : t("updater.new_version").replace("{version}", version)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {status === "available" && (
          <button
            onClick={onInstall}
            className="rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white shadow-[0_0_10px_rgba(108,108,237,0.25)] hover:bg-accent-hover transition-colors cursor-pointer"
          >
            {t("updater.download")}
          </button>
        )}
        {status !== "downloading" && (
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
