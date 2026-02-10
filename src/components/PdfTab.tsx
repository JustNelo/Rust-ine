import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, FolderOpen, FileDown, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ProgressBar } from "./ProgressBar";
import { useFileSelection } from "../hooks/useFileSelection";
import { useOutputDir } from "../hooks/useOutputDir";
import type { PdfExtractionResult } from "../types";

interface AggregatedPdfResult {
  total_extracted: number;
  errors: string[];
}

export function PdfTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { outputDir, selectOutputDir } = useOutputDir();
  const [loading, setLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ completed: number; total: number } | null>(null);
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
      toast.error("Please select at least one PDF file.");
      return;
    }
    if (!outputDir) {
      toast.error("Please select an output directory.");
      return;
    }

    setLoading(true);
    setResult(null);
    setPdfProgress({ completed: 0, total: files.length });

    const aggregated: AggregatedPdfResult = { total_extracted: 0, errors: [] };

    for (let i = 0; i < files.length; i++) {
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
      setPdfProgress({ completed: i + 1, total: files.length });
    }

    setResult(aggregated);

    if (aggregated.total_extracted > 0 && aggregated.errors.length === 0) {
      toast.success(`${aggregated.total_extracted} image(s) extracted from ${files.length} PDF(s)!`);
    } else if (aggregated.total_extracted > 0) {
      toast.warning(
        `${aggregated.total_extracted} image(s) extracted with ${aggregated.errors.length} error(s).`
      );
    } else if (aggregated.errors.length > 0) {
      toast.error("Failed to extract images from PDF(s).");
    } else {
      toast.info("No images found in the selected PDF(s).");
    }

    setLoading(false);
    setPdfProgress(null);
  }, [files, outputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label="Drop PDF files here"
        sublabel="Images embedded in the PDFs will be extracted"
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={handleRemoveFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={selectOutputDir}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:border-border-hover hover:bg-surface-hover transition-all cursor-pointer"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Output folder
        </button>
        {outputDir && (
          <span className="text-xs text-text-muted truncate max-w-75">
            {outputDir}
          </span>
        )}
      </div>

      <button
        onClick={handleExtract}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {loading ? "Extracting..." : "Extract Images"}
      </button>

      {loading && pdfProgress && (
        <ProgressBar completed={pdfProgress.completed} total={pdfProgress.total} />
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {result.total_extracted} image(s) extracted
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
