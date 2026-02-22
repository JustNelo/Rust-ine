import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { cn } from "../lib/utils";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, OutputFormat, ProcessingResult } from "../types";

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "bmp", label: "BMP" },
  { value: "ico", label: "ICO" },
  { value: "tiff", label: "TIFF" },
];

export function ConvertTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
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

  const handleConvert = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("convert");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const result = await invoke<BatchProgress>("convert_images", {
        inputPaths: files,
        outputFormat: outputFormat,
        outputDir: outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(t("toast.convert_success", { n: result.completed, format: outputFormat.toUpperCase() }));
        await openOutputDir("convert");
      } else if (result.completed > 0) {
        toast.warning(t("toast.partial", { completed: result.completed, total: result.total }));
        await openOutputDir("convert");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.converting")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, outputFormat, getOutputDir, openOutputDir]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp,gif"
        label={t("dropzone.images_convert")}
        sublabel={t("dropzone.sublabel_convert")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">
            {t("label.output_format")}
          </label>
          <div className="flex gap-2">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => setOutputFormat(fmt.value)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer",
                  outputFormat === fmt.value
                    ? "border-glass-border bg-accent-muted text-white"
                    : "border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover"
                )}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      <button
        onClick={handleConvert}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRightLeft className="h-4 w-4" />
        )}
        {loading ? t("status.converting") : files.length > 0 ? t("action.convert_n", { n: files.length, format: outputFormat.toUpperCase() }) : t("action.convert", { format: outputFormat.toUpperCase() })}
      </button>

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
