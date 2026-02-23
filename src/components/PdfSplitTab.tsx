import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Scissors, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface PdfSplitResult {
  output_files: string[];
  errors: string[];
}

export function PdfSplitTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [ranges, setRanges] = useState("1-end");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdfSplitResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    // Only accept one PDF at a time for splitting
    addFiles(paths.slice(0, 1));
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleSplit = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_pdf"));
      return;
    }
    const outputDir = await getOutputDir("pdf-split");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<PdfSplitResult>("split_pdf", {
        pdfPath: files[0],
        ranges: ranges,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.output_files.length > 0 && res.errors.length === 0) {
        toast.success(t("toast.pdf_split_success", { n: res.output_files.length }));
        await openOutputDir("pdf-split");
      } else if (res.output_files.length > 0) {
        toast.warning(t("toast.partial", { completed: res.output_files.length, total: ranges.split(",").length }));
        await openOutputDir("pdf-split");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.splitting")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, ranges, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label={t("dropzone.pdf_split")}
        sublabel={t("dropzone.sublabel_pdf_split")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.page_ranges")}
        </label>
        <input
          type="text"
          value={ranges}
          onChange={(e) => setRanges(e.target.value)}
          placeholder="1-3, 4-10, 11-end"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-border-hover focus:outline-none"
        />
        <p className="text-[10px] text-text-muted">
          {t("label.page_ranges_hint")}
        </p>
      </div>

      <button
        onClick={handleSplit}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Scissors className="h-4 w-4" />
        )}
        {loading ? t("status.splitting") : t("action.pdf_split")}
      </button>

      {result && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.split_files", { n: result.output_files.length })}
            </span>
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
