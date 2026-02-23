import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Scaling } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, ProcessingResult, ResizeMode } from "../types";

const MODE_KEYS: { value: ResizeMode; labelKey: string }[] = [
  { value: "percentage", labelKey: "label.percentage" },
  { value: "width", labelKey: "label.by_width" },
  { value: "height", labelKey: "label.by_height" },
  { value: "exact", labelKey: "label.exact" },
];

const PRESETS: { labelKey: string; w: number; h: number }[] = [
  { labelKey: "preset.1080p", w: 1920, h: 1080 },
  { labelKey: "preset.4k", w: 3840, h: 2160 },
  { labelKey: "preset.instagram_square", w: 1080, h: 1080 },
  { labelKey: "preset.instagram_story", w: 1080, h: 1920 },
  { labelKey: "preset.twitter_header", w: 1500, h: 500 },
  { labelKey: "preset.youtube_thumb", w: 1280, h: 720 },
];

export function ResizeTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
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
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("resize");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResults([]);

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
        toast.success(t("toast.resize_success", { n: result.completed }));
        await openOutputDir("resize");
      } else if (result.completed > 0) {
        toast.warning(t("toast.partial", { completed: result.completed, total: result.total }));
        await openOutputDir("resize");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.resizing")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, mode, width, height, percentage, getOutputDir, openOutputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp,gif"
        label={t("dropzone.images_resize")}
        sublabel={t("dropzone.sublabel_resize")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {MODE_KEYS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                mode === opt.value
                  ? "bg-accent-muted text-white border border-glass-border"
                  : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">
            {t("label.presets")}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((preset) => (
              <button
                key={preset.labelKey}
                onClick={() => {
                  setMode("exact");
                  setWidth(preset.w);
                  setHeight(preset.h);
                }}
                className="rounded-md bg-surface border border-border px-2.5 py-1 text-[10px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-all cursor-pointer"
              >
                {t(preset.labelKey)} ({preset.w}x{preset.h})
              </button>
            ))}
          </div>
        </div>

        {mode === "percentage" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">
                {t("label.scale")}
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
            <label className="text-xs text-text-secondary w-12">{t("label.width")}</label>
            <input
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-border-hover focus:outline-none"
            />
            <span className="text-xs text-text-muted">{t("label.px")}</span>
          </div>
        )}

        {(mode === "height" || mode === "exact") && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary w-12">{t("label.height")}</label>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-border-hover focus:outline-none"
            />
            <span className="text-xs text-text-muted">{t("label.px")}</span>
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
        {loading ? t("status.resizing") : files.length > 0 ? t("action.resize_n", { n: files.length }) : t("action.resize")}
      </button>

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
