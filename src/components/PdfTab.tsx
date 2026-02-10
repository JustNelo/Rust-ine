import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, FolderOpen, FileDown, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useOutputDir } from "../hooks/useOutputDir";
import type { PdfExtractionResult } from "../types";

export function PdfTab() {
  const [files, setFiles] = useState<string[]>([]);
  const { outputDir, selectOutputDir } = useOutputDir();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdfExtractionResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    setFiles(paths.slice(0, 1));
    setResult(null);
  }, []);

  const handleRemoveFile = useCallback((_index: number) => {
    setFiles([]);
    setResult(null);
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setResult(null);
  }, []);

  const handleExtract = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Please select a PDF file.");
      return;
    }
    if (!outputDir) {
      toast.error("Please select an output directory.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<PdfExtractionResult>("extract_pdf_images", {
        pdfPath: files[0],
        outputDir: outputDir,
      });

      setResult(res);

      if (res.extracted_count > 0 && res.errors.length === 0) {
        toast.success(`${res.extracted_count} image(s) extracted from PDF!`);
      } else if (res.extracted_count > 0) {
        toast.warning(
          `${res.extracted_count} image(s) extracted with ${res.errors.length} error(s).`
        );
      } else if (res.errors.length > 0) {
        toast.error("Failed to extract images from PDF.");
      } else {
        toast.info("No images found in this PDF.");
      }
    } catch (err) {
      toast.error(`Extraction failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, outputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        multiple={false}
        label="Drop a PDF file here"
        sublabel="Images embedded in the PDF will be extracted"
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

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {result.extracted_count} image(s) extracted
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
