import { useMemo } from "react";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import type { ProcessingResult } from "../types";

interface ResultsBannerProps {
  results: ProcessingResult[];
  total: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ResultsBanner({ results, total }: ResultsBannerProps) {
  if (results.length === 0) return null;

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const sizeStats = useMemo(() => {
    const successResults = results.filter((r) => r.success);
    const totalInput = successResults.reduce((acc, r) => acc + r.input_size, 0);
    const totalOutput = successResults.reduce((acc, r) => acc + r.output_size, 0);
    const saved = totalInput > 0 ? ((1 - totalOutput / totalInput) * 100) : 0;
    return { totalInput, totalOutput, saved };
  }, [results]);

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center gap-2">
        {failed === 0 ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : succeeded === 0 ? (
          <XCircle className="h-4 w-4 text-error" />
        ) : (
          <AlertCircle className="h-4 w-4 text-warning" />
        )}
        <span className="text-xs font-medium text-text-primary">
          {succeeded}/{total} processed successfully
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
  );
}
