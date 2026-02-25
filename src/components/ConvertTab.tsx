import { useState, useCallback } from "react";
import { ArrowRightLeft } from "lucide-react";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { cn } from "../lib/utils";
import { useTabProcessor } from "../hooks/useTabProcessor";
import { useT } from "../i18n/i18n";
import type { OutputFormat } from "../types";

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
  const {
    files, removeFile, handleFilesSelected, handleClearFiles,
    loading, results, process,
  } = useTabProcessor({ tabId: "convert", command: "convert_images" });
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");

  const handleConvert = useCallback(async () => {
    await process({
      extraParams: { outputFormat },
      successMessage: t("toast.convert_success", { n: files.length, format: outputFormat.toUpperCase() }),
      errorPrefix: t("status.converting"),
    });
  }, [process, outputFormat, files.length, t]);

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
