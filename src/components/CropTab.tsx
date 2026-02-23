import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Crop } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
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

      <button
        onClick={handleCrop}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Crop className="h-4 w-4" />
        )}
        {loading ? t("status.cropping") : files.length > 0 ? t("action.crop_n", { n: files.length }) : t("action.crop")}
      </button>

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
