import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Loader2, FileDown, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { PdfExtractionResult } from "../types";

interface AggregatedPdfResult {
  total_extracted: number;
  errors: string[];
}

export function PdfTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AggregatedPdfResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths);
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleRemoveFile = useCallback((index: number) => {
    removeFile(index);
    setResult(null);
  }, [removeFile]);

  const handleExtract = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_pdf"));
      return;
    }
    const outputDir = await getOutputDir("pdf");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    const aggregated: AggregatedPdfResult = { total_extracted: 0, errors: [] };
    const total = files.length;

    for (let i = 0; i < total; i++) {
      try {
        const res = await invoke<PdfExtractionResult>("extract_pdf_images", {
          pdfPath: files[i],
          outputDir: outputDir,
        });
        aggregated.total_extracted += res.extracted_count;
        aggregated.errors.push(...res.errors);
      } catch (err) {
        const filename = files[i].split(/[\\/]/).pop() || files[i];
        aggregated.errors.push(`${filename}: ${err}`);
      }
      await emit("processing-progress", { completed: i + 1, total });
    }

    setResult(aggregated);

    if (aggregated.total_extracted > 0 && aggregated.errors.length === 0) {
      toast.success(t("toast.extract_success", { n: aggregated.total_extracted }));
      await openOutputDir("pdf");
    } else if (aggregated.total_extracted > 0) {
      toast.warning(t("toast.partial", { completed: aggregated.total_extracted, total: total }));
      await openOutputDir("pdf");
    } else if (aggregated.errors.length > 0) {
      toast.error(t("toast.all_failed"));
    } else {
      toast.info(t("result.no_images"));
    }

    setLoading(false);
    await emit("processing-progress", { completed: total, total });
  }, [files, getOutputDir, openOutputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label={t("dropzone.pdf")}
        sublabel={t("dropzone.sublabel_pdf")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={handleRemoveFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      <button
        onClick={handleExtract}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {loading ? t("status.extracting") : t("action.extract")}
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
              {t("result.extracted", { n: result.total_extracted })}
            </span>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-error/80"
                >
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
