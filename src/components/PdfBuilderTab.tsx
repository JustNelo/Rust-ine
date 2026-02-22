import { useState, useCallback, useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-dialog";
import { Loader2, FileUp, CheckCircle, XCircle, Plus, Trash2, Upload } from "lucide-react";
import { PdfPageGrid } from "./PdfPageGrid";
import { usePdfBuilder } from "../hooks/usePdfBuilder";
import type { MergePdfOptions } from "../types";

const ACCEPTED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf",
]);

export function PdfBuilderTab() {
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
    const safeName = outputName.endsWith(".pdf") ? outputName : `${outputName}.pdf`;
    const outputPath = await save({
      title: "Save PDF as...",
      defaultPath: safeName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!outputPath) return;

    const options: MergePdfOptions = {
      page_format: "fit",
      orientation: "portrait",
      margin_px: 0,
      image_quality: 90,
      output_path: outputPath,
    };

    await buildPdf(options);
  }, [buildPdf, outputName]);

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
            <p className="text-sm font-medium text-text-primary">Drop images or PDFs here</p>
            <p className="mt-1 text-xs text-text-muted">Each image becomes a page. PDF pages are extracted individually.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddMore}
            className="flex items-center gap-2 rounded-xl border border-glass-border bg-surface-card px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-white transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add files
          </button>
          <span className="text-[10px] text-text-muted">
            or drop files anywhere in the window
          </span>
          <button
            onClick={clearPages}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-white hover:bg-surface-hover transition-all cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            Clear all
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
            placeholder="document.pdf"
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
            {loading ? "Building..." : "Build PDF"}
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
              {result.page_count} page(s) in final PDF
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
