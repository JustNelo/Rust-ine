import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { cn } from "../lib/utils";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, OutputFormat, ProcessingResult } from "../types";

const FORMAT_INFO: Record<string, { type: string; alpha: boolean }> = {
  png: { type: "Lossless", alpha: true },
  jpg: { type: "Lossy", alpha: false },
  webp: { type: "Lossy/Lossless", alpha: true },
  bmp: { type: "Uncompressed", alpha: false },
  ico: { type: "Lossless", alpha: true },
  tiff: { type: "Lossless", alpha: true },
};

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

        {/* Format info badges */}
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-surface border border-border px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {FORMAT_INFO[outputFormat]?.type}
          </span>
          {FORMAT_INFO[outputFormat]?.alpha && (
            <span className="rounded-md bg-surface border border-border px-2 py-0.5 text-[10px] font-medium text-accent">
              Alpha ✓
            </span>
          )}
          {!FORMAT_INFO[outputFormat]?.alpha && (
            <span className="rounded-md bg-surface border border-border px-2 py-0.5 text-[10px] font-medium text-text-muted/50">
              No alpha
            </span>
          )}
        </div>

      </div>

      <ActionButton
        onClick={handleConvert}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.converting")}
        text={files.length > 0 ? t("action.convert_n", { n: files.length, format: outputFormat.toUpperCase() }) : t("action.convert", { format: outputFormat.toUpperCase() })}
        icon={<ArrowRightLeft className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
