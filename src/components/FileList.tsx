import { useState, useCallback, memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { X, FileText, ZoomIn } from "lucide-react";
import { isImage } from "../lib/utils";
import { useT } from "../i18n/i18n";

interface FileListProps {
  files: string[];
  onRemove: (index: number) => void;
  onClear: () => void;
  type?: "image" | "pdf";
}

export const FileList = memo(function FileList({ files, onRemove, onClear, type = "image" }: FileListProps) {
  const { t } = useT();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const openPreview = useCallback((file: string) => {
    setPreviewSrc(convertFileSrc(file));
    setPreviewName(file.split(/[\\/]/).pop() || file);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewSrc(null);
    setPreviewName("");
  }, []);

  if (files.length === 0) return null;

  const showThumbnails = type === "image";

  return (
    <>
      <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-text-secondary">
            {t("label.n_files_selected", { n: files.length })}
          </span>
          <button
            onClick={onClear}
            className="text-xs text-text-muted hover:text-white transition-colors cursor-pointer"
          >
            {t("label.clear_all")}
          </button>
        </div>

        {showThumbnails ? (
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
            {files.map((file, index) => {
              const name = file.split(/[\\/]/).pop() || file;
              const canPreview = isImage(file);
              return (
                <div
                  key={`${file}-${index}`}
                  className="group relative rounded-xl overflow-hidden border border-glass-border bg-accent/2 aspect-square"
                >
                  {canPreview ? (
                    <img
                      src={convertFileSrc(file)}
                      alt={name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <FileText className="h-6 w-6 text-text-muted" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                    {canPreview && (
                      <button
                        onClick={() => openPreview(file)}
                        className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors cursor-pointer backdrop-blur-sm"
                        title="Preview"
                      >
                        <ZoomIn className="h-3.5 w-3.5 text-white" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(index);
                      }}
                      className="rounded-full bg-white/20 p-1.5 hover:bg-red-500/80 transition-colors cursor-pointer backdrop-blur-sm"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-1.5 py-1">
                    <span className="text-[10px] text-white/80 truncate block">
                      {name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1">
            {files.map((file, index) => {
              const name = file.split(/[\\/]/).pop() || file;
              return (
                <div
                  key={`${file}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span className="text-xs text-text-secondary truncate">{name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-white transition-all cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative max-w-[85vw] max-h-[85vh] rounded-2xl overflow-hidden border border-glass-border bg-surface-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card border-b border-glass-border">
              <span className="text-xs font-medium text-text-secondary truncate max-w-md">
                {previewName}
              </span>
              <button
                onClick={closePreview}
                className="rounded-full p-1 hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>
            <div className="flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
              <img
                src={previewSrc}
                alt={previewName}
                className="max-w-full max-h-[75vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
