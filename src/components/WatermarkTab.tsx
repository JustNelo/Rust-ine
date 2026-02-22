import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ProgressBar } from "./ProgressBar";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useProcessingProgress } from "../hooks/useProcessingProgress";
import type { BatchProgress, ProcessingResult, WatermarkPosition } from "../types";

const POSITION_OPTIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
  { value: "tiled", label: "Tiled" },
];

export function WatermarkTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
  const { progress, resetProgress } = useProcessingProgress();
  const [text, setText] = useState("");
  const [position, setPosition] = useState<WatermarkPosition>("center");
  const [opacity, setOpacity] = useState(30);
  const [fontSize, setFontSize] = useState(48);
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

  const handleWatermark = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Please select at least one image.");
      return;
    }
    if (!text.trim()) {
      toast.error("Please enter watermark text.");
      return;
    }
    const outputDir = await getOutputDir("watermark");
    if (!outputDir) {
      toast.error("Please set a workspace folder in Settings.");
      return;
    }

    setLoading(true);
    setResults([]);
    resetProgress();

    try {
      const result = await invoke<BatchProgress>("add_watermark", {
        inputPaths: files,
        text: text.trim(),
        position,
        opacity: opacity / 100,
        fontSize: fontSize,
        outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(`Watermark added to ${result.completed} image(s)!`);
      } else if (result.completed > 0) {
        toast.warning(
          `${result.completed}/${result.total} processed. Some files failed.`
        );
      } else {
        toast.error("All files failed to process.");
      }
    } catch (err) {
      toast.error(`Watermark failed: ${err}`);
    } finally {
      setLoading(false);
      resetProgress();
    }
  }, [files, text, position, opacity, fontSize, getOutputDir, resetProgress]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label="Drop images here to watermark"
        sublabel="A text watermark will be overlaid on each image"
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            Watermark Text
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. CONFIDENTIAL, your name..."
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-hover focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            Position
          </label>
          <div className="flex gap-2 flex-wrap">
            {POSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPosition(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  position === opt.value
                    ? "bg-accent-muted text-white border border-glass-border"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              Opacity
            </label>
            <span className="text-xs font-mono text-text-muted">{opacity}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(108,108,237,0.4)]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              Font size
            </label>
            <span className="text-xs font-mono text-text-muted">{fontSize}px</span>
          </div>
          <input
            type="range"
            min={8}
            max={200}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(108,108,237,0.4)]"
          />
        </div>
      </div>

      <button
        onClick={handleWatermark}
        disabled={loading || files.length === 0 || !text.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Stamp className="h-4 w-4" />
        )}
        {loading ? "Applying..." : files.length > 0 ? `Watermark ${files.length} image${files.length > 1 ? "s" : ""}` : "Apply Watermark"}
      </button>

      {loading && progress && (
        <ProgressBar completed={progress.completed} total={progress.total} />
      )}

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
