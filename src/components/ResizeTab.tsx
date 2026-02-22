import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Scaling } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ProgressBar } from "./ProgressBar";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useProcessingProgress } from "../hooks/useProcessingProgress";
import type { BatchProgress, ProcessingResult, ResizeMode } from "../types";

const MODE_OPTIONS: { value: ResizeMode; label: string }[] = [
  { value: "percentage", label: "Percentage" },
  { value: "width", label: "Fit to Width" },
  { value: "height", label: "Fit to Height" },
  { value: "exact", label: "Exact Dimensions" },
];

export function ResizeTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
  const { progress, resetProgress } = useProcessingProgress();
  const [mode, setMode] = useState<ResizeMode>("percentage");
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [percentage, setPercentage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);

  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths);
      setResults([]);
    },
    [addFiles]
  );

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResults([]);
  }, [clearFiles]);

  const handleResize = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Please select at least one image.");
      return;
    }
    const outputDir = await getOutputDir("resize");
    if (!outputDir) {
      toast.error("Please set a workspace folder in Settings.");
      return;
    }

    setLoading(true);
    setResults([]);
    resetProgress();

    try {
      const result = await invoke<BatchProgress>("resize_images", {
        inputPaths: files,
        mode,
        width,
        height,
        percentage,
        outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(`${result.completed} image(s) resized!`);
      } else if (result.completed > 0) {
        toast.warning(
          `${result.completed}/${result.total} resized. Some files failed.`
        );
      } else {
        toast.error("All files failed to resize.");
      }
    } catch (err) {
      toast.error(`Resize failed: ${err}`);
    } finally {
      setLoading(false);
      resetProgress();
    }
  }, [files, mode, width, height, percentage, getOutputDir, resetProgress]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp,gif"
        label="Drop images here to resize"
        sublabel="PNG, JPG, BMP, ICO, TIFF, WebP, GIF supported"
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                mode === opt.value
                  ? "bg-accent-muted text-white border border-glass-border"
                  : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mode === "percentage" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">
                Scale
              </label>
              <span className="text-xs font-mono text-text-muted">
                {percentage}%
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(108,108,237,0.4)]"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>1%</span>
              <span>200%</span>
            </div>
          </div>
        )}

        {(mode === "width" || mode === "exact") && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary w-12">Width</label>
            <input
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-border-hover focus:outline-none"
            />
            <span className="text-xs text-text-muted">px</span>
          </div>
        )}

        {(mode === "height" || mode === "exact") && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary w-12">Height</label>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-border-hover focus:outline-none"
            />
            <span className="text-xs text-text-muted">px</span>
          </div>
        )}
      </div>

      <button
        onClick={handleResize}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Scaling className="h-4 w-4" />
        )}
        {loading ? "Resizing..." : files.length > 0 ? `Resize ${files.length} image${files.length > 1 ? "s" : ""}` : "Resize Images"}
      </button>

      {loading && progress && (
        <ProgressBar completed={progress.completed} total={progress.total} />
      )}

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
