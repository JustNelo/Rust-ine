import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Crop } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, ProcessingResult } from "../types";

type CropRatio = "free" | "16:9" | "9:16" | "4:3" | "3:2" | "1:1";
type CropAnchor = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const RATIOS: { value: CropRatio; label: string }[] = [
  { value: "free", label: "label.free" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
];

const ANCHORS: { value: CropAnchor; labelKey: string }[] = [
  { value: "center", labelKey: "label.center" },
  { value: "top-left", labelKey: "label.top_left" },
  { value: "top-right", labelKey: "label.top_right" },
  { value: "bottom-left", labelKey: "label.bottom_left" },
  { value: "bottom-right", labelKey: "label.bottom_right" },
];

function parseRatio(ratio: CropRatio): { w: number; h: number } | null {
  if (ratio === "free") return null;
  const [w, h] = ratio.split(":").map(Number);
  return { w, h };
}

export function CropTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [ratio, setRatio] = useState<CropRatio>("1:1");
  const [anchor, setAnchor] = useState<CropAnchor>("center");
  const [cropWidth, setCropWidth] = useState(1080);
  const [cropHeight, setCropHeight] = useState(1080);
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

  // Compute the crop overlay position as CSS percentages
  const cropOverlay = useMemo(() => {
    const parsed = parseRatio(ratio);
    if (!parsed) return null; // free mode — no fixed overlay
    const { w, h } = parsed;
    const aspectRatio = w / h;

    // Assume a square container; compute the crop rect relative to it
    // The overlay shows what portion of the image will be kept
    const containerAspect = 1; // preview is aspect-square
    let cropW: number, cropH: number;
    if (aspectRatio > containerAspect) {
      cropW = 100;
      cropH = (containerAspect / aspectRatio) * 100;
    } else {
      cropH = 100;
      cropW = (aspectRatio / containerAspect) * 100;
    }

    // Position based on anchor
    let top = 0, left = 0;
    switch (anchor) {
      case "center":
        top = (100 - cropH) / 2;
        left = (100 - cropW) / 2;
        break;
      case "top-left":
        top = 0; left = 0;
        break;
      case "top-right":
        top = 0; left = 100 - cropW;
        break;
      case "bottom-left":
        top = 100 - cropH; left = 0;
        break;
      case "bottom-right":
        top = 100 - cropH; left = 100 - cropW;
        break;
    }

    return { top: `${top}%`, left: `${left}%`, width: `${cropW}%`, height: `${cropH}%` };
  }, [ratio, anchor]);

  const handleCrop = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("crop");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const result = await invoke<BatchProgress>("crop_images", {
        inputPaths: files,
        ratio: ratio,
        anchor: anchor,
        width: cropWidth,
        height: cropHeight,
        outputDir: outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(t("toast.crop_success", { n: result.completed }));
        await openOutputDir("crop");
      } else if (result.completed > 0) {
        toast.warning(t("toast.partial", { completed: result.completed, total: result.total }));
        await openOutputDir("crop");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.cropping")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, ratio, anchor, cropWidth, cropHeight, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_crop")}
        sublabel={t("dropzone.sublabel_crop")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Crop preview with overlay */}
      {files.length > 0 && (
        <div className="relative rounded-xl overflow-hidden border border-glass-border bg-black aspect-video max-h-52">
          <img
            src={convertFileSrc(files[0])}
            alt=""
            className="w-full h-full object-contain opacity-40"
          />
          {cropOverlay && (
            <div
              className="absolute border-2 border-accent rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-200"
              style={cropOverlay}
            />
          )}
          <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white/70 backdrop-blur-sm">
            {ratio === "free" ? `${cropWidth}×${cropHeight}` : ratio}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.crop_ratio")}
        </label>
        <div className="flex gap-2 flex-wrap">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRatio(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                ratio === r.value
                  ? "bg-accent-muted text-white border border-glass-border"
                  : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {r.value === "free" ? t(r.label) : r.label}
            </button>
          ))}
        </div>

        {ratio === "free" && (
          <div className="flex gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-text-secondary w-12">{t("label.width")}</label>
              <input
                type="number"
                min={1}
                value={cropWidth}
                onChange={(e) => setCropWidth(Number(e.target.value))}
                className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-border-hover focus:outline-none"
              />
              <span className="text-xs text-text-muted">{t("label.px")}</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-text-secondary w-12">{t("label.height")}</label>
              <input
                type="number"
                min={1}
                value={cropHeight}
                onChange={(e) => setCropHeight(Number(e.target.value))}
                className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-border-hover focus:outline-none"
              />
              <span className="text-xs text-text-muted">{t("label.px")}</span>
            </div>
          </div>
        )}

        <label className="text-xs font-medium text-text-secondary">
          {t("label.anchor")}
        </label>
        <div className="flex gap-2 flex-wrap">
          {ANCHORS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAnchor(a.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                anchor === a.value
                  ? "bg-accent-muted text-white border border-glass-border"
                  : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {t(a.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <ActionButton
        onClick={handleCrop}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.cropping")}
        text={files.length > 0 ? t("action.crop_n", { n: files.length }) : t("action.crop")}
        icon={<Crop className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
