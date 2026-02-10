import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, FolderOpen, Zap } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ProgressBar } from "./ProgressBar";
import { useFileSelection } from "../hooks/useFileSelection";
import { useOutputDir } from "../hooks/useOutputDir";
import { useProcessingProgress } from "../hooks/useProcessingProgress";
import type { BatchProgress, ProcessingResult } from "../types";

export function CompressTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { outputDir, selectOutputDir } = useOutputDir();
  const { progress, resetProgress } = useProcessingProgress();
  const [quality, setQuality] = useState(80);
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

  const handleCompress = useCallback(async () => {
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
    resetProgress();

    try {
      const result = await invoke<BatchProgress>("compress_webp", {
        inputPaths: files,
        quality: quality,
        outputDir: outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(`${result.completed} image(s) compressed to WebP!`);
      } else if (result.completed > 0) {
        toast.warning(
          `${result.completed}/${result.total} compressed. Some files failed.`
        );
      } else {
        toast.error("All files failed to compress.");
      }
    } catch (err) {
      toast.error(`Compression failed: ${err}`);
    } finally {
      setLoading(false);
      resetProgress();
    }
  }, [files, quality, outputDir, resetProgress]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp"
        label="Drop images here to compress to WebP"
        sublabel="PNG, JPG, BMP, ICO, TIFF supported"
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">
            Quality
          </label>
          <span className="text-xs font-mono text-text-muted">{quality}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="w-full accent-accent h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Smaller file</span>
          <span>Higher quality</span>
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

      <button
        onClick={handleCompress}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        {loading ? "Compressing..." : "Compress to WebP"}
      </button>

      {loading && progress && (
        <ProgressBar completed={progress.completed} total={progress.total} />
      )}

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
