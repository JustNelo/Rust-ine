import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ProgressBar } from "./ProgressBar";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useProcessingProgress } from "../hooks/useProcessingProgress";
import type { BatchProgress, ProcessingResult } from "../types";

export function CompressTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
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
    const outputDir = await getOutputDir("compress");
    if (!outputDir) {
      toast.error("Please set a workspace folder in Settings.");
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
  }, [files, quality, getOutputDir, resetProgress]);

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
          className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(108,108,237,0.4)]"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Smaller file</span>
          <span>Higher quality</span>
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
          <Zap className="h-4 w-4" />
        )}
        {loading ? "Compressing..." : files.length > 0 ? `Compress ${files.length} image${files.length > 1 ? "s" : ""}` : "Compress to WebP"}
      </button>

      {loading && progress && (
        <ProgressBar completed={progress.completed} total={progress.total} />
      )}

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
