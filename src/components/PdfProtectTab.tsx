import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Lock, Unlock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface PdfProtectResult {
  output_path: string;
  success: boolean;
  errors: string[];
}

type Mode = "protect" | "unlock";

export function PdfProtectTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [mode, setMode] = useState<Mode>("protect");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdfProtectResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleAction = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_pdf"));
      return;
    }
    if (!password.trim()) {
      toast.error(t("label.pdf_password"));
      return;
    }
    const outputDir = await getOutputDir("pdf-protect");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const command = mode === "protect" ? "protect_pdf_cmd" : "unlock_pdf_cmd";
      const res = await invoke<PdfProtectResult>(command, {
        pdfPath: files[0],
        password: password,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.success) {
        toast.success(
          mode === "protect"
            ? t("toast.pdf_protect_success")
            : t("toast.pdf_unlock_success")
        );
        await openOutputDir("pdf-protect");
      } else {
        toast.error(res.errors[0] || t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, password, mode, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label={t("dropzone.pdf_protect")}
        sublabel={t("dropzone.sublabel_pdf_protect")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      {/* Mode selector */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {(["protect", "unlock"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                mode === m
                  ? "bg-accent text-white shadow-[0_0_12px_rgba(108,108,237,0.3)]"
                  : "bg-surface-card text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {m === "protect" ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              {m === "protect" ? t("label.pdf_mode_protect") : t("label.pdf_mode_unlock")}
            </button>
          ))}
        </div>
      </div>

      {/* Password input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.pdf_password")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <button
        onClick={handleAction}
        disabled={loading || files.length === 0 || !password.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "protect" ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
        {loading
          ? mode === "protect"
            ? t("status.protecting_pdf")
            : t("status.unlocking_pdf")
          : mode === "protect"
            ? t("action.protect_pdf")
            : t("action.unlock_pdf")}
      </button>

      {result && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-error" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {result.success
                ? mode === "protect"
                  ? t("result.pdf_protected")
                  : t("result.pdf_unlocked")
                : result.errors[0] || t("toast.all_failed")}
            </span>
          </div>
          {result.errors.length > 0 && !result.success && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-error/80">
                  <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
