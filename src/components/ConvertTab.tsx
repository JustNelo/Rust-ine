import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, FolderOpen, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { cn } from "../lib/utils";
import { useFileSelection } from "../hooks/useFileSelection";
import { useOutputDir } from "../hooks/useOutputDir";
import type { BatchProgress, OutputFormat, ProcessingResult } from "../types";

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "bmp", label: "BMP" },
  { value: "ico", label: "ICO" },
  { value: "tiff", label: "TIFF" },
];

export function ConvertTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { outputDir, selectOutputDir } = useOutputDir();
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths);
    setResults([]);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResults([]);
  }, [clearFiles]);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Please select at least one image.");
      return;
    }
    if (!outputDir) {
      toast.error("Please select an output directory.");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const result = await invoke<BatchProgress>("convert_images", {
        inputPaths: files,
        outputFormat: outputFormat,
        outputDir: outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(
          `${result.completed} image(s) converted to ${outputFormat.toUpperCase()}!`
        );
      } else if (result.completed > 0) {
        toast.warning(
          `${result.completed}/${result.total} converted. Some files failed.`
        );
      } else {
        toast.error("All files failed to convert.");
      }
    } catch (err) {
      toast.error(`Conversion failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, outputFormat, outputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp,gif"
        label="Drop images here to convert"
        sublabel="PNG, JPG, BMP, ICO, TIFF, WebP, GIF supported"
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">
            Output format
          </label>
          <div className="flex gap-2">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => setOutputFormat(fmt.value)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer",
                  outputFormat === fmt.value
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover"
                )}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

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
      </div>

      <button
        onClick={handleConvert}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRightLeft className="h-4 w-4" />
        )}
        {loading ? "Converting..." : `Convert to ${outputFormat.toUpperCase()}`}
      </button>

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
