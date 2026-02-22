import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, ProcessingResult } from "../types";

export function CompressTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
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

    try {
      const result = await invoke<BatchProgress>("compress_webp", {
        inputPaths: files,
        quality: quality,
        outputDir: outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(t("toast.compress_success", { n: result.completed }));
        await openOutputDir("compress");
      } else if (result.completed > 0) {
        toast.warning(t("toast.partial", { completed: result.completed, total: result.total }));
        await openOutputDir("compress");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.compressing")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, quality, getOutputDir, openOutputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp"
        label={t("dropzone.images_compress")}
        sublabel={t("dropzone.sublabel_compress")}
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
            {t("label.quality")}
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
          <span>{t("label.smaller_file")}</span>
          <span>{t("label.higher_quality")}</span>
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
        {loading ? t("status.compressing") : files.length > 0 ? t("action.compress_n", { n: files.length }) : t("action.compress")}
      </button>

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
