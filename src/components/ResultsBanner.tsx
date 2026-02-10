import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import type { ProcessingResult } from "../types";

interface ResultsBannerProps {
  results: ProcessingResult[];
  total: number;
}

export function ResultsBanner({ results, total }: ResultsBannerProps) {
  if (results.length === 0) return null;

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

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
