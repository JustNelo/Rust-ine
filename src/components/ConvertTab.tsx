import { useState, useCallback } from "react";
import { ArrowRightLeft } from "lucide-react";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
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
    files, removeFile, reorderFiles, handleFilesSelected, handleClearFiles,
    loading, results, lastOutputDir, process,
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

      <ImageGrid
        files={files}
        onReorder={reorderFiles}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            {t("label.output_format")}
          </label>
          <div className="flex gap-2">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => setOutputFormat(fmt.value)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 cursor-pointer ${
                  outputFormat === fmt.value
                    ? "bg-indigo-500/10 text-indigo-300 border border-indigo-400/25"
                    : "bg-white/5 border border-white/10 text-neutral-200 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Format info badges */}
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/4 border border-white/8 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
            {FORMAT_INFO[outputFormat]?.type}
          </span>
          {FORMAT_INFO[outputFormat]?.alpha && (
            <span className="rounded-md bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
              Alpha ✓
            </span>
          )}
          {!FORMAT_INFO[outputFormat]?.alpha && (
            <span className="rounded-md bg-white/4 border border-white/8 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
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
        icon={<ArrowRightLeft className="h-4 w-4" strokeWidth={1.5} />}
      />

      <ResultsBanner results={results} total={files.length} outputDir={lastOutputDir} />
    </div>
  );
}
