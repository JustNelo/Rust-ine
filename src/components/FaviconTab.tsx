import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Globe, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface FaviconResult {
  zip_path: string;
  generated_files: string[];
  errors: string[];
}

export function FaviconTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FaviconResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("favicon");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<FaviconResult>("generate_favicons", {
        imagePath: files[0],
        outputDir: outputDir,
      });

      setResult(res);

      if (res.generated_files.length > 0 && res.errors.length === 0) {
        toast.success(t("toast.favicon_success"));
        await openOutputDir("favicon");
      } else if (res.generated_files.length > 0) {
        toast.warning(t("toast.partial", { completed: res.generated_files.length, total: res.generated_files.length + res.errors.length }));
        await openOutputDir("favicon");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.generating_favicons")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_favicon")}
        sublabel={t("dropzone.sublabel_favicon")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <button
        onClick={handleGenerate}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Globe className="h-4 w-4" />
        )}
        {loading ? t("status.generating_favicons") : t("action.generate_favicons")}
      </button>

      {result && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.favicons_generated")}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {result.generated_files.map((file) => (
              <span
                key={file}
                className="rounded-md bg-surface border border-border px-2 py-1 text-[10px] font-mono text-text-secondary"
              >
                {file}
              </span>
            ))}
          </div>

          {result.errors.length > 0 && (
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
