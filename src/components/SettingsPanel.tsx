import { useState, useCallback, useRef, useEffect } from "react";
import { X, FolderOpen, RotateCcw, Globe, RefreshCw, Loader2, CheckCircle, AlertCircle, Sun, Moon } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useT, type Lang } from "../i18n/i18n";
import { useWorkspace } from "../hooks/useWorkspace";
import { useTheme } from "../hooks/useTheme";
import { GlassModal } from "./ui/GlassModal";

interface SettingsPanelProps {
  onClose: () => void;
  onResetOnboarding: () => void;
}

export function SettingsPanel({ onClose, onResetOnboarding }: SettingsPanelProps) {
  const { lang, setLang, t } = useT();
  const { workspace, selectWorkspace, openInExplorer } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "downloading" | "up-to-date" | "error">("idle");
  const [foundUpdate, setFoundUpdate] = useState<Awaited<ReturnType<typeof check>> | null>(null);
  const [foundVersion, setFoundVersion] = useState("");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent setting state on unmounted component
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus("checking");
    try {
      const update = await check();
      if (update) {
        setFoundUpdate(update);
        setFoundVersion(update.version);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
        statusTimerRef.current = setTimeout(() => setUpdateStatus("idle"), 3000);
      }
    } catch {
      setUpdateStatus("error");
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!foundUpdate) return;
    setUpdateStatus("downloading");
    try {
      await foundUpdate.downloadAndInstall();
      await relaunch();
    } catch {
      setUpdateStatus("error");
    }
  }, [foundUpdate]);

  return (
    <GlassModal>
        <button
          onClick={onClose}
          className="btn-icon absolute right-4 top-4 z-10"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <h2 className="relative text-lg font-light text-neutral-900 dark:text-white mb-6">{t("settings.title")}</h2>

        <div className="relative space-y-5">
          {/* Language */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("settings.language")}
            </label>
            <div className="flex gap-2">
              {(["en", "fr"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`btn-toggle ${lang === l ? "btn-toggle-active" : ""}`}
                >
                  {l === "en" ? "English" : "Français"}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              {theme === "dark" ? (
                <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {t("settings.theme")}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { if (theme !== "dark") toggleTheme(); }}
                className={`btn-toggle ${theme === "dark" ? "btn-toggle-active" : ""}`}
              >
                <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t("settings.theme_dark")}
              </button>
              <button
                onClick={() => { if (theme !== "light") toggleTheme(); }}
                className={`btn-toggle ${theme === "light" ? "btn-toggle-active" : ""}`}
              >
                <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t("settings.theme_light")}
              </button>
            </div>
          </div>

          {/* Workspace */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("settings.workspace")}
            </label>
            {workspace ? (
              <div className="rounded-lg border border-black/12 dark:border-white/8 bg-black/5 dark:bg-white/3 px-3 py-2">
                <p className="text-[11px] text-neutral-900 dark:text-white truncate">{workspace}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={selectWorkspace}
                    className="btn-pill"
                  >
                    {t("settings.change")}
                  </button>
                  <button
                    onClick={openInExplorer}
                    className="btn-pill"
                  >
                    {t("settings.open_explorer")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={selectWorkspace}
                className="btn-toggle w-full border-dashed"
              >
                {t("onboarding.choose_folder")}
              </button>
            )}
          </div>

          {/* Reset Onboarding */}
          <div className="pt-2 border-t border-black/10 dark:border-white/6">
            <button
              onClick={onResetOnboarding}
              className="btn-ghost"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("settings.reset_onboarding")}
            </button>
          </div>

          {/* Updates */}
          <div className="pt-2 border-t border-black/10 dark:border-white/6 space-y-2">
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === "checking" || updateStatus === "downloading"}
              className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateStatus === "checking" || updateStatus === "downloading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : updateStatus === "up-to-date" ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-400" strokeWidth={1.5} />
              ) : updateStatus === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-400" strokeWidth={1.5} />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {updateStatus === "checking" ? t("status.scanning")
                : updateStatus === "downloading" ? t("updater.downloading")
                : updateStatus === "up-to-date" ? t("updater.up_to_date")
                : updateStatus === "error" ? t("updater.error")
                : t("updater.check")}
            </button>

            {updateStatus === "available" && (
              <div className="flex items-center justify-between rounded-lg border border-black/12 dark:border-white/10 bg-black/6 dark:bg-white/4 px-3 py-2">
                <span className="text-xs text-neutral-900 dark:text-white">
                  {t("updater.new_version").replace("{version}", foundVersion)}
                </span>
                <button
                  onClick={handleInstallUpdate}
                  className="btn-primary-sm"
                >
                  {t("updater.download")}
                </button>
              </div>
            )}
          </div>

        </div>
    </GlassModal>
  );
}
