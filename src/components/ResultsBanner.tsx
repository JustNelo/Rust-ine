import { useMemo, useState, useCallback, memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { CheckCircle, AlertCircle, XCircle, ArrowRight, X, ZoomIn } from "lucide-react";
import { formatSize, isImage } from "../lib/utils";
import { useT } from "../i18n/i18n";
import type { ProcessingResult } from "../types";

interface ResultsBannerProps {
  results: ProcessingResult[];
  total: number;
}

export const ResultsBanner = memo(function ResultsBanner({ results, total }: ResultsBannerProps) {
  const { t } = useT();
  const [previewResult, setPreviewResult] = useState<ProcessingResult | null>(null);

  const closePreview = useCallback(() => setPreviewResult(null), []);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const successResults = results.filter((r) => r.success);

  const sizeStats = useMemo(() => {
    const totalInput = successResults.reduce((acc, r) => acc + r.input_size, 0);
    const totalOutput = successResults.reduce((acc, r) => acc + r.output_size, 0);
    const saved = totalInput > 0 ? ((1 - totalOutput / totalInput) * 100) : 0;
    return { totalInput, totalOutput, saved };
  }, [results]);

  if (results.length === 0) return null;

  return (
    <>
      <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          {failed === 0 ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : succeeded === 0 ? (
            <XCircle className="h-4 w-4 text-error" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
          <span className="text-xs font-medium text-text-primary">
            {t("result.processed", { succeeded, total })}
          </span>
        </div>

        {succeeded > 0 && sizeStats.totalInput > 0 && (
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>{formatSize(sizeStats.totalInput)}</span>
            <span className="text-text-muted">→</span>
            <span>{formatSize(sizeStats.totalOutput)}</span>
            {sizeStats.saved > 0 && (
              <span className="ml-auto font-medium text-success">
                -{sizeStats.saved.toFixed(1)}%
              </span>
            )}
            {sizeStats.saved < 0 && (
              <span className="ml-auto font-medium text-warning">
                +{Math.abs(sizeStats.saved).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {successResults.length > 0 && (
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {successResults.map((r, i) => {
              const outName = r.output_path.split(/[\\/]/).pop() || "";
              const canPreview = isImage(r.output_path);
              return (
                <div
                  key={i}
                  className="group relative rounded-xl overflow-hidden border border-glass-border bg-accent/2 aspect-square cursor-pointer"
                  onClick={() => canPreview && setPreviewResult(r)}
                >
                  {canPreview ? (
                    <img
                      src={`${convertFileSrc(r.output_path)}?t=${Date.now()}`}
                      alt={outName}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-success/50" />
                    </div>
                  )}

                  {canPreview && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-1.5 py-1">
                    <span className="text-[10px] text-white/80 truncate block">
                      {outName}
                    </span>
                    <span className="text-[9px] text-white/50">
                      {formatSize(r.output_size)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {failed > 0 && (
          <div className="max-h-24 overflow-y-auto space-y-1">
            {results
              .filter((r) => !r.success)
              .map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-error/80">
                  <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="truncate">
                    {r.input_path.split(/[\\/]/).pop()}: {r.error}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {previewResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative max-w-[90vw] max-h-[85vh] rounded-2xl overflow-hidden border border-glass-border bg-surface-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card border-b border-glass-border">
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span className="font-medium">{t("preview.before_after")}</span>
                <span className="text-text-muted">
                  {formatSize(previewResult.input_size)}
                </span>
                <ArrowRight className="h-3 w-3 text-text-muted" />
                <span className="text-text-muted">
                  {formatSize(previewResult.output_size)}
                </span>
                {previewResult.input_size > 0 && (
                  <span className={
                    previewResult.output_size <= previewResult.input_size
                      ? "font-medium text-success"
                      : "font-medium text-warning"
                  }>
                    {previewResult.output_size <= previewResult.input_size ? "-" : "+"}
                    {Math.abs((1 - previewResult.output_size / previewResult.input_size) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <button
                onClick={closePreview}
                className="rounded-full p-1 hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>

            <div className="flex gap-0.5 p-4 max-h-[75vh] overflow-auto" style={{ background: '#0a0a0a' }}>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  {t("preview.original")}
                </span>
                <div className="rounded-xl overflow-hidden border border-glass-border">
                  <img
                    src={`${convertFileSrc(previewResult.input_path)}?t=${Date.now()}`}
                    alt="Before"
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                </div>
                <span className="text-[10px] text-text-muted">
                  {previewResult.input_path.split(/[\\/]/).pop()}
                </span>
                {previewResult.input_width > 0 && (
                  <span className="text-[10px] font-mono text-text-muted">
                    {previewResult.input_width} × {previewResult.input_height} px
                  </span>
                )}
              </div>

              <div className="flex items-center px-2">
                <ArrowRight className="h-5 w-5 text-text-muted" />
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  {t("preview.result")}
                </span>
                <div className="rounded-xl overflow-hidden border border-glass-border">
                  <img
                    src={`${convertFileSrc(previewResult.output_path)}?t=${Date.now()}`}
                    alt="After"
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                </div>
                <span className="text-[10px] text-text-muted">
                  {previewResult.output_path.split(/[\\/]/).pop()}
                </span>
                {previewResult.output_width > 0 && (
                  <span className={`text-[10px] font-mono ${
                    previewResult.input_width !== previewResult.output_width ||
                    previewResult.input_height !== previewResult.output_height
                      ? "text-white font-semibold"
                      : "text-text-muted"
                  }`}>
                    {previewResult.output_width} × {previewResult.output_height} px
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
