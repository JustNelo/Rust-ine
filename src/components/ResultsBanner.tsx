import { useMemo, useState, useCallback, memo } from "react";
import { CheckCircle, AlertCircle, XCircle, ZoomIn, FolderOpen } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { formatSize, isImage, safeAssetUrl } from "../lib/utils";
import { BeforeAfterSlider } from "./ui/BeforeAfterSlider";
import { useT } from "../i18n/i18n";
import type { ProcessingResult } from "../types";

interface ResultsBannerProps {
  results: ProcessingResult[];
  total: number;
  outputDir?: string;
}

export const ResultsBanner = memo(function ResultsBanner({ results, total, outputDir }: ResultsBannerProps) {
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
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-3 space-y-3">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            {failed === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-400" strokeWidth={1.5} />
            ) : succeeded === 0 ? (
              <XCircle className="h-4 w-4 text-red-400" strokeWidth={1.5} />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
            )}
            <span className="text-xs font-medium text-white">
              {t("result.processed", { succeeded, total })}
            </span>
          </div>
          {outputDir && (
            <button
              onClick={() => revealItemInDir(outputDir)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-neutral-400 hover:bg-white/4 hover:text-white transition-colors duration-200 cursor-pointer"
            >
              <FolderOpen className="h-3 w-3" strokeWidth={1.5} />
              {t("label.open_output_folder")}
            </button>
          )}
        </div>

        {succeeded > 0 && sizeStats.totalInput > 0 && (
          <div className="relative flex items-center gap-3 text-xs text-neutral-300">
            <span>{formatSize(sizeStats.totalInput)}</span>
            <span className="text-neutral-500">→</span>
            <span>{formatSize(sizeStats.totalOutput)}</span>
            {sizeStats.saved > 0 && (
              <span className="ml-auto font-medium text-green-400">
                -{sizeStats.saved.toFixed(1)}%
              </span>
            )}
            {sizeStats.saved < 0 && (
              <span className="ml-auto font-medium text-amber-400">
                +{Math.abs(sizeStats.saved).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {successResults.length > 0 && (
          <div
            className="relative max-h-48 overflow-y-auto pr-1"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: "6px",
            }}
          >
            {successResults.map((r, i) => {
              const outName = r.output_path.split(/[\\/]/).pop() || "";
              const canPreview = isImage(r.output_path);
              return (
                <div
                  key={i}
                  className="group relative rounded-xl overflow-hidden border border-white/8 bg-white/3 aspect-square cursor-pointer"
                  onClick={() => canPreview && setPreviewResult(r)}
                >
                  {canPreview ? (
                    <img
                      src={safeAssetUrl(r.output_path, true)}
                      alt={outName}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400/50" strokeWidth={1.5} />
                    </div>
                  )}

                  {canPreview && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="h-4 w-4 text-white" strokeWidth={1.5} />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-1.5 py-1">
                    <span className="text-[10px] text-neutral-200 truncate block">
                      {outName}
                    </span>
                    <span className="text-[9px] text-neutral-500">
                      {formatSize(r.output_size)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {failed > 0 && (
          <div className="relative max-h-24 overflow-y-auto space-y-1">
            {results
              .filter((r) => !r.success)
              .map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-400/80">
                  <XCircle className="h-3 w-3 shrink-0 mt-0.5" strokeWidth={1.5} />
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
