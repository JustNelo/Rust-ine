import { useState, useCallback } from "react";
import { X, FolderOpen, RotateCcw, Globe, RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useT, type Lang } from "../i18n/i18n";
import { useWorkspace } from "../hooks/useWorkspace";

interface SettingsPanelProps {
  onClose: () => void;
  onResetOnboarding: () => void;
}

export function SettingsPanel({ onClose, onResetOnboarding }: SettingsPanelProps) {
  const { lang, setLang, t } = useT();
  const { workspace, selectWorkspace, openInExplorer } = useWorkspace();
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "downloading" | "up-to-date" | "error">("idle");

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus("checking");
    try {
      const update = await check();
      if (update) {
        setUpdateStatus("downloading");
        await update.downloadAndInstall();
        await relaunch();
      } else {
        setUpdateStatus("up-to-date");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }
    } catch {
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus("idle"), 3000);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-glass-border bg-background p-6 shadow-[0_0_40px_rgba(108,108,237,0.15)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-text-primary mb-6">{t("settings.title")}</h2>

        <div className="space-y-5">
          {/* Language */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <Globe className="h-3.5 w-3.5" />
              {t("settings.language")}
            </label>
            <div className="flex gap-2">
              {(["en", "fr"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                    lang === l
                      ? "bg-accent text-white shadow-[0_0_12px_rgba(108,108,237,0.3)]"
                      : "bg-surface-card text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {l === "en" ? "English" : "Français"}
                </button>
              ))}
            </div>
          </div>

          {/* Workspace */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <FolderOpen className="h-3.5 w-3.5" />
              {t("settings.workspace")}
            </label>
            {workspace ? (
              <div className="rounded-lg border border-border bg-surface-card px-3 py-2">
                <p className="text-[11px] text-text-primary truncate">{workspace}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={selectWorkspace}
                    className="rounded-md bg-surface-hover px-2.5 py-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {t("settings.change")}
                  </button>
                  <button
                    onClick={openInExplorer}
                    className="rounded-md bg-surface-hover px-2.5 py-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {t("settings.open_explorer")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={selectWorkspace}
                className="w-full rounded-lg border border-dashed border-border-hover bg-surface-card px-3 py-3 text-xs text-text-muted hover:text-text-primary hover:border-accent/30 transition-colors cursor-pointer"
              >
                {t("onboarding.choose_folder")}
              </button>
            )}
          </div>

          {/* Reset Onboarding */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={onResetOnboarding}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("settings.reset_onboarding")}
            </button>
          </div>

          {/* Updates */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === "checking" || updateStatus === "downloading"}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateStatus === "checking" || updateStatus === "downloading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : updateStatus === "up-to-date" ? (
                <CheckCircle className="h-3.5 w-3.5 text-success" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {updateStatus === "checking" ? t("status.scanning")
                : updateStatus === "downloading" ? t("updater.downloading")
                : updateStatus === "up-to-date" ? t("updater.up_to_date")
                : t("updater.check")}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
