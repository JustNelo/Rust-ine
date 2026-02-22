import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, ProcessingResult, WatermarkPosition } from "../types";

const POSITION_KEYS: { value: WatermarkPosition; labelKey: string }[] = [
  { value: "center", labelKey: "label.center" },
  { value: "bottom-right", labelKey: "label.bottom_right" },
  { value: "bottom-left", labelKey: "label.bottom_left" },
  { value: "top-right", labelKey: "label.top_right" },
  { value: "top-left", labelKey: "label.top_left" },
  { value: "tiled", labelKey: "label.tiled" },
];

export function WatermarkTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
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
      toast.error(t("toast.select_images"));
      return;
    }
    if (!text.trim()) {
      toast.error(t("toast.watermark_text_missing"));
      return;
    }
    const outputDir = await getOutputDir("watermark");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResults([]);

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
        toast.success(t("toast.watermark_success", { n: result.completed }));
        await openOutputDir("watermark");
      } else if (result.completed > 0) {
        toast.warning(t("toast.partial", { completed: result.completed, total: result.total }));
        await openOutputDir("watermark");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.watermarking")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, text, position, opacity, fontSize, getOutputDir, openOutputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_watermark")}
        sublabel={t("dropzone.sublabel_watermark")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            {t("label.watermark_text")}
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("label.placeholder_watermark")}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-hover focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            {t("label.position")}
          </label>
          <div className="flex gap-2 flex-wrap">
            {POSITION_KEYS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPosition(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  position === opt.value
                    ? "bg-accent-muted text-white border border-glass-border"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              {t("label.opacity")}
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
              {t("label.font_size")}
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
        {loading ? t("status.watermarking") : files.length > 0 ? t("action.watermark_n", { n: files.length }) : t("action.watermark")}
      </button>

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
