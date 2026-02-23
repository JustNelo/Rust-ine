import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Stamp } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { Slider } from "./ui/Slider";
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

      {/* Live watermark preview */}
      {files.length > 0 && text.trim() && (
        <div className="relative rounded-xl overflow-hidden border border-glass-border bg-black aspect-video max-h-48">
          <img
            src={convertFileSrc(files[0])}
            alt=""
            className="w-full h-full object-contain"
          />
          <div
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              ...(position === "center" ? { inset: 0 } : {}),
              ...(position === "top-left" ? { top: "8%", left: "8%" } : {}),
              ...(position === "top-right" ? { top: "8%", right: "8%" } : {}),
              ...(position === "bottom-left" ? { bottom: "8%", left: "8%" } : {}),
              ...(position === "bottom-right" ? { bottom: "8%", right: "8%" } : {}),
              ...(position === "tiled" ? { inset: 0, flexWrap: "wrap", gap: "16px" } : {}),
            }}
          >
            {position === "tiled" ? (
              Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="text-white/20 font-bold select-none"
                  style={{ fontSize: `${Math.max(10, fontSize * 0.15)}px` }}
                >
                  {text}
                </span>
              ))
            ) : (
              <span
                className="text-white font-bold select-none"
                style={{
                  fontSize: `${Math.max(10, fontSize * 0.2)}px`,
                  opacity: opacity / 100,
                }}
              >
                {text}
              </span>
            )}
          </div>
        </div>
      )}

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

        <Slider
          label={t("label.opacity")}
          value={opacity}
          min={5}
          max={100}
          onChange={setOpacity}
        />

        <Slider
          label={t("label.font_size")}
          value={fontSize}
          min={8}
          max={200}
          unit="px"
          onChange={setFontSize}
        />
      </div>

      <ActionButton
        onClick={handleWatermark}
        disabled={files.length === 0 || !text.trim()}
        loading={loading}
        loadingText={t("status.watermarking")}
        text={files.length > 0 ? t("action.watermark_n", { n: files.length }) : t("action.watermark")}
        icon={<Stamp className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
