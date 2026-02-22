import { useState, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-dialog";
import { Loader2, FileUp, CheckCircle, XCircle, Plus, Trash2 } from "lucide-react";
import { DropZone } from "./DropZone";
import { PdfPageGrid } from "./PdfPageGrid";
import { usePdfBuilder } from "../hooks/usePdfBuilder";
import type { MergePdfOptions } from "../types";

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

  const [pageFormat, setPageFormat] = useState("a4");
  const [orientation, setOrientation] = useState("portrait");
  const [margin, setMargin] = useState(20);
  const [imageQuality, setImageQuality] = useState(85);
  const [outputName, setOutputName] = useState("document.pdf");

  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths);
    },
    [addFiles]
  );

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
    const outputPath = await save({
      title: "Save PDF as...",
      defaultPath: outputName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!outputPath) return;

    const options: MergePdfOptions = {
      page_format: pageFormat,
      orientation,
      margin_px: margin,
      image_quality: imageQuality,
      output_path: outputPath,
    };

    await buildPdf(options);
  }, [outputName, pageFormat, orientation, margin, imageQuality, buildPdf]);

  return (
    <div className="space-y-5">
      {pages.length === 0 ? (
        <DropZone
          accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp,pdf"
          label="Drop images or PDFs here"
          sublabel="Each image becomes a page. PDF pages are extracted individually."
          onFilesSelected={handleFilesSelected}
        />
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

      {pages.length > 0 && (
        <>

          {/* Options */}
          <div className="space-y-3 rounded-2xl border border-glass-border bg-surface-card p-3">
            {/* Page format */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Page format
              </label>
              <div className="flex gap-2">
                {[
                  { value: "a4", label: "A4" },
                  { value: "letter", label: "Letter" },
                  { value: "fit", label: "Fit to image" },
                ].map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setPageFormat(fmt.value)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      pageFormat === fmt.value
                        ? "border-glass-border bg-accent-muted text-white"
                        : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation */}
            {pageFormat !== "fit" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Orientation
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setOrientation(opt.value)}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        orientation === opt.value
                          ? "border-glass-border bg-accent-muted text-white"
                          : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Margin slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">
                  Margin
                </label>
                <span className="text-xs font-mono text-text-muted">
                  {margin}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(255,255,255,0.3)]"
              />
            </div>

            {/* Image quality slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">
                  Image quality
                </label>
                <span className="text-xs font-mono text-text-muted">
                  {imageQuality}%
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={100}
                value={imageQuality}
                onChange={(e) => setImageQuality(Number(e.target.value))}
                className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(255,255,255,0.3)]"
              />
            </div>

            {/* Output filename */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Output filename
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-border-hover focus:outline-none"
              />
            </div>
          </div>
        </>
      )}

      {/* Build button */}
      <button
        onClick={handleBuild}
        disabled={loading || pages.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.08)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {loading ? "Building PDF..." : "Build PDF"}
      </button>

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
