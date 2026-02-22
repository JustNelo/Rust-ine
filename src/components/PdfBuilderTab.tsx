import { useState, useCallback, useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { Loader2, FileUp, CheckCircle, XCircle, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PdfPageGrid } from "./PdfPageGrid";
import { usePdfBuilder } from "../hooks/usePdfBuilder";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { MergePdfOptions } from "../types";

const ACCEPTED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf",
]);

export function PdfBuilderTab() {
  const { t } = useT();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const {
    pages,
    loading,
    loadingThumbnails,
    result,
    addFiles,
    removePage,
    reorderPages,
    clearPages,
    buildPdf,
  } = usePdfBuilder();

  const [outputName, setOutputName] = useState("document.pdf");

  // Window-level drag-drop listener — active even when DropZone is hidden
  const filterPaths = useMemo(() => {
    return (paths: string[]) =>
      paths.filter((p) => {
        const ext = p.split(".").pop()?.toLowerCase() || "";
        return ACCEPTED_EXTENSIONS.has(ext);
      });
  }, []);

  // Always-active window-level drag-drop listener
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const filtered = filterPaths(event.payload.paths);
        if (filtered.length > 0) addFiles(filtered);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [filterPaths, addFiles]);

  const handleAddMore = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Images & PDFs",
            extensions: [
              "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf",
            ],
          },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        addFiles(paths);
      }
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, [addFiles]);

  const handleBuild = useCallback(async () => {
    const outputDir = await getOutputDir("pdf-builder");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    const safeName = outputName.endsWith(".pdf") ? outputName : `${outputName}.pdf`;
    const sep = outputDir.includes("/") ? "/" : "\\";
    const outputPath = `${outputDir}${sep}${safeName}`;

    const options: MergePdfOptions = {
      page_format: "fit",
      orientation: "portrait",
      margin_px: 0,
      image_quality: 90,
      output_path: outputPath,
    };

    await buildPdf(options);
    await openOutputDir("pdf-builder");
  }, [buildPdf, outputName, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      {pages.length === 0 ? (
        <div
          onClick={handleAddMore}
          className="relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent/20 bg-accent/2 p-8 cursor-pointer transition-all duration-200 hover:bg-accent/5 hover:border-accent/30 hover:shadow-[0_0_20px_rgba(108,108,237,0.08)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent/70">
            <Upload className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">{t("dropzone.pdf_builder")}</p>
            <p className="mt-1 text-xs text-text-muted">{t("dropzone.sublabel_pdf_builder")}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddMore}
            className="flex items-center gap-2 rounded-xl border border-glass-border bg-surface-card px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-white transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t("label.add_files")}
          </button>
          <span className="text-[10px] text-text-muted">
            {t("label.or_drop_anywhere")}
          </span>
          <button
            onClick={clearPages}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-white hover:bg-surface-hover transition-all cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            {t("label.clear_all")}
          </button>
        </div>
      )}

      <PdfPageGrid
        pages={pages}
        loadingThumbnails={loadingThumbnails}
        onReorder={reorderPages}
        onRemove={removePage}
      />

      {/* Output filename + Build button */}
      {pages.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            placeholder={t("label.placeholder_filename")}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-hover focus:outline-none"
          />
          <button
            onClick={handleBuild}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {loading ? t("status.building") : t("action.build_pdf")}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("toast.build_success", { n: result.page_count })}
            </span>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-error/80"
                >
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
