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
    <div className="relative z-20 flex items-center justify-between gap-3 border-b border-white/8 bg-white/2 backdrop-blur-xl px-4 py-2">
      <div className="flex items-center gap-2.5">
        {status === "downloading" ? (
          <Loader2 className="h-3.5 w-3.5 text-neutral-400 animate-spin shrink-0" strokeWidth={1.5} />
        ) : status === "error" ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" strokeWidth={1.5} />
        ) : (
          <Download className="h-3.5 w-3.5 text-neutral-400 shrink-0" strokeWidth={1.5} />
        )}
        <span className="text-xs text-white">
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
            className="rounded-md bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-900 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:bg-white transition-colors duration-300 cursor-pointer"
          >
            {t("updater.download")}
          </button>
        )}
        {status !== "downloading" && (
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-neutral-500 hover:text-white hover:bg-white/6 transition-colors duration-200 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}
