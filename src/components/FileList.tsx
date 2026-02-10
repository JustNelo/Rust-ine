import { X, FileImage, FileText } from "lucide-react";

interface FileListProps {
  files: string[];
  onRemove: (index: number) => void;
  onClear: () => void;
  type?: "image" | "pdf";
}

export function FileList({ files, onRemove, onClear, type = "image" }: FileListProps) {
  if (files.length === 0) return null;

  const Icon = type === "pdf" ? FileText : FileImage;

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary">
          {files.length} file{files.length > 1 ? "s" : ""} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs text-text-muted hover:text-error transition-colors cursor-pointer"
        >
          Clear all
        </button>
      </div>
      <div className="max-h-36 overflow-y-auto space-y-1">
        {files.map((file, index) => {
          const name = file.split(/[\\/]/).pop() || file;
          return (
            <div
              key={`${file}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <span className="text-xs text-text-secondary truncate">{name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
