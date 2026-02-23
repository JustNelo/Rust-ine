import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, FileDown, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface PdfCompressResult {
  output_path: string;
  original_size: number;
  compressed_size: number;
  errors: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function PdfCompressTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [quality, setQuality] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdfCompressResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleCompress = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_pdf"));
      return;
    }
    const outputDir = await getOutputDir("pdf-compress");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<PdfCompressResult>("compress_pdf_cmd", {
        pdfPath: files[0],
        quality: quality,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.errors.length === 0 && res.output_path) {
        toast.success(t("toast.pdf_compress_success", { size: formatBytes(res.compressed_size) }));
        await openOutputDir("pdf-compress");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.compressing_pdf")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, quality, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label={t("dropzone.pdf_compress")}
        sublabel={t("dropzone.sublabel_pdf_compress")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">
            {t("label.image_quality_pdf")}
          </label>
          <span className="text-xs font-mono text-text-muted">{quality}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={95}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>{t("label.smaller_file")}</span>
          <span>{t("label.higher_quality")}</span>
        </div>
      </div>

      <button
        onClick={handleCompress}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {loading ? t("status.compressing_pdf") : t("action.pdf_compress")}
      </button>

      {result && result.output_path && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.pdf_compressed", {
                original: formatBytes(result.original_size),
                compressed: formatBytes(result.compressed_size),
              })}
            </span>
          </div>

          {result.original_size > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${Math.max(5, (result.compressed_size / result.original_size) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                {result.original_size > result.compressed_size
                  ? `-${(((result.original_size - result.compressed_size) / result.original_size) * 100).toFixed(1)}%`
                  : "No reduction"}
              </span>
            </div>
          )}

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
