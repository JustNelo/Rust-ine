import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Loader2, FileUp, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { useFileSelection } from "../hooks/useFileSelection";
import type { ImagesToPdfResult } from "../types";

export function ImagesToPdfTab() {
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImagesToPdfResult | null>(null);

  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths);
      setResult(null);
    },
    [addFiles]
  );

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleCreate = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Please select at least one image.");
      return;
    }

    const outputPath = await save({
      title: "Save PDF as...",
      defaultPath: "images.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!outputPath) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<ImagesToPdfResult>("images_to_pdf", {
        inputPaths: files,
        outputPath,
      });

      setResult(res);

      if (res.page_count > 0 && res.errors.length === 0) {
        toast.success(`PDF created with ${res.page_count} page(s)!`);
      } else if (res.page_count > 0) {
        toast.warning(
          `PDF created with ${res.page_count} page(s), ${res.errors.length} error(s).`
        );
      } else {
        toast.error("Failed to create PDF.");
      }
    } catch (err) {
      toast.error(`PDF creation failed: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label="Drop images here to combine into a PDF"
        sublabel="Each image will become a page in the PDF"
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <button
        onClick={handleCreate}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {loading ? "Creating PDF..." : "Create PDF"}
      </button>

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {result.page_count} page(s) added to PDF
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
