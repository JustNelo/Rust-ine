import { useMemo, useState, useCallback, memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { CheckCircle, AlertCircle, XCircle, ZoomIn } from "lucide-react";
import { formatSize, isImage } from "../lib/utils";
import { BeforeAfterSlider } from "./ui/BeforeAfterSlider";
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
        <BeforeAfterSlider result={previewResult} onClose={closePreview} />
      )}
    </>
  );
});
