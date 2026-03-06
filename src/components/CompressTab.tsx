import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { Slider } from "./ui/Slider";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, ProcessingResult } from "../types";

type CompressFormat = "webp" | "jpeg";

export function CompressTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
  const [format, setFormat] = useState<CompressFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [lastOutputDir, setLastOutputDir] = useState("");

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
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("compress");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResults([]);
    setLastOutputDir(outputDir);

    try {
      const command = format === "webp" ? "compress_webp" : "compress_jpeg";
      const result = await invoke<BatchProgress>(command, {
        inputPaths: files,
        quality,
        outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(t("toast.compress_success", { n: result.completed, format: format.toUpperCase() }));
      } else if (result.completed > 0) {
        toast.warning(t("toast.partial", { completed: result.completed, total: result.total }));
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.compressing")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, format, quality, getOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp"
        label={t("dropzone.images_compress")}
        sublabel={t("dropzone.sublabel_compress")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid
        files={files}
        onReorder={reorderFiles}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.output_format")}
        </label>
        <div className="flex gap-2">
          {(["webp", "jpeg"] as CompressFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 cursor-pointer ${
                format === f
                  ? "bg-indigo-500/10 text-indigo-300 border border-indigo-400/25"
                  : "bg-white/5 border border-white/10 text-neutral-200 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label={t("label.quality")}
        value={quality}
        min={1}
        max={100}
        leftHint={t("label.smaller_file")}
        rightHint={t("label.higher_quality")}
        onChange={setQuality}
      />

      <ActionButton
        onClick={handleCompress}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.compressing")}
        text={files.length > 0 ? t("action.compress_n", { n: files.length }) : t("action.compress")}
        icon={<Zap className="h-4 w-4" strokeWidth={1.5} />}
      />

      <ResultsBanner results={results} total={files.length} outputDir={lastOutputDir} />
    </div>
  );
}
