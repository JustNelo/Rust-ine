import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Image, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface PdfToImagesResult {
  pdf_path: string;
  output_dir: string;
  exported_count: number;
  errors: string[];
}

type ExportFormat = "png" | "jpg";
type ExportDpi = 72 | 150 | 300;

export function PdfToImagesTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [dpi, setDpi] = useState<ExportDpi>(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ exported: number; errors: string[] } | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths);
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleExport = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_pdf"));
      return;
    }
    const outputDir = await getOutputDir("pdf-to-images");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    const aggregated = { exported: 0, errors: [] as string[] };

    for (const file of files) {
      try {
        const res = await invoke<PdfToImagesResult>("pdf_to_images", {
          pdfPath: file,
          outputDir: outputDir,
          format: format,
          dpi: dpi,
        });
        aggregated.exported += res.exported_count;
        aggregated.errors.push(...res.errors);
      } catch (err) {
        const filename = file.split(/[\\/]/).pop() || file;
        aggregated.errors.push(`${filename}: ${err}`);
      }
    }

    setResult(aggregated);

    if (aggregated.exported > 0 && aggregated.errors.length === 0) {
      toast.success(t("toast.pdf_to_images_success", { n: aggregated.exported }));
      await openOutputDir("pdf-to-images");
    } else if (aggregated.exported > 0) {
      toast.warning(t("toast.partial", { completed: aggregated.exported, total: files.length }));
      await openOutputDir("pdf-to-images");
    } else {
      toast.error(t("toast.all_failed"));
    }

    setLoading(false);
  }, [files, format, dpi, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="pdf"
        label={t("dropzone.pdf_to_images")}
        sublabel={t("dropzone.sublabel_pdf_to_images")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
        type="pdf"
      />

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">
            {t("label.output_format_images")}
          </label>
          <div className="flex gap-2">
            {(["png", "jpg"] as ExportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-md px-4 py-1.5 text-xs font-medium uppercase transition-all cursor-pointer ${
                  format === f
                    ? "bg-accent-muted text-white border border-glass-border"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-2 block">
            {t("label.dpi")}
          </label>
          <div className="flex gap-2">
            {([72, 150, 300] as ExportDpi[]).map((d) => (
              <button
                key={d}
                onClick={() => setDpi(d)}
                className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  dpi === d
                    ? "bg-accent-muted text-white border border-glass-border"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {d} DPI
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Image className="h-4 w-4" />
        )}
        {loading ? t("status.exporting_pages") : t("action.pdf_to_images")}
      </button>

      {result && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.exported_pages", { n: result.exported })}
            </span>
          </div>
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
