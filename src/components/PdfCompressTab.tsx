import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileDown, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatSize } from "../lib/utils";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ActionButton } from "./ui/ActionButton";
import { Slider } from "./ui/Slider";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface PdfCompressResult {
  output_path: string;
  original_size: number;
  compressed_size: number;
  errors: string[];
}

export function PdfCompressTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [quality, setQuality] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdfCompressResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleCompress = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_pdf"));
      return;
    }
    const outputDir = await getOutputDir("pdf-compress");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<PdfCompressResult>("compress_pdf_cmd", {
        pdfPath: files[0],
        quality: quality,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.errors.length === 0 && res.output_path) {
        toast.success(t("toast.pdf_compress_success", { size: formatSize(res.compressed_size) }));
        await openOutputDir("pdf-compress");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.compressing_pdf")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, quality, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label={t("dropzone.pdf_compress")}
        sublabel={t("dropzone.sublabel_pdf_compress")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      <Slider
        label={t("label.image_quality_pdf")}
        value={quality}
        min={10}
        max={95}
        leftHint={t("label.smaller_file")}
        rightHint={t("label.higher_quality")}
        onChange={setQuality}
      />

      <ActionButton
        onClick={handleCompress}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.compressing_pdf")}
        text={t("action.pdf_compress")}
        icon={<FileDown className="h-4 w-4" />}
      />

      {result && result.output_path && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.pdf_compressed", {
                original: formatSize(result.original_size),
                compressed: formatSize(result.compressed_size),
              })}
            </span>
          </div>

          {result.original_size > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${Math.max(5, (result.compressed_size / result.original_size) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                {result.original_size > result.compressed_size
                  ? `-${(((result.original_size - result.compressed_size) / result.original_size) * 100).toFixed(1)}%`
                  : "No reduction"}
              </span>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-error/80">
                  <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
