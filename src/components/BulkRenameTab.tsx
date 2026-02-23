import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PenLine, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ActionButton } from "./ui/ActionButton";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface RenameEntry {
  original_name: string;
  new_name: string;
}

interface RenameResult {
  renamed_count: number;
  results: RenameEntry[];
  errors: string[];
}

const TOKENS = ["{name}", "{index}", "{date}", "{ext}"];

export function BulkRenameTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [pattern, setPattern] = useState("{name}_{index}");
  const [startIndex, setStartIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RenameResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths);
    setResult(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  // Live preview of new names
  const previewNames = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return files.slice(0, 5).map((file, i) => {
      const parts = file.replace(/\\/g, "/").split("/");
      const fullName = parts[parts.length - 1] || file;
      const dotIdx = fullName.lastIndexOf(".");
      const stem = dotIdx > 0 ? fullName.slice(0, dotIdx) : fullName;
      const ext = dotIdx > 0 ? fullName.slice(dotIdx + 1) : "";
      const idx = startIndex + i;

      let newName = pattern
        .replace(/\{name\}/g, stem)
        .replace(/\{index\}/g, String(idx).padStart(3, "0"))
        .replace(/\{date\}/g, today)
        .replace(/\{ext\}/g, ext);

      if (!newName.includes(".") && ext) {
        newName = `${newName}.${ext}`;
      }

      return { original: fullName, preview: newName };
    });
  }, [files, pattern, startIndex]);

  const handleRename = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("bulk-rename");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<RenameResult>("bulk_rename_cmd", {
        inputPaths: files,
        pattern: pattern,
        startIndex: startIndex,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.renamed_count > 0 && res.errors.length === 0) {
        toast.success(t("toast.rename_success", { n: res.renamed_count }));
        await openOutputDir("bulk-rename");
      } else if (res.renamed_count > 0) {
        toast.warning(t("toast.partial", { completed: res.renamed_count, total: files.length }));
        await openOutputDir("bulk-rename");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, pattern, startIndex, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp,gif,ico,svg"
        label={t("dropzone.images_bulk_rename")}
        sublabel={t("dropzone.sublabel_bulk_rename")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Pattern input */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.rename_pattern")}
        </label>
        <input
          type="text"
          value={pattern}
          onChange={(e) => { setPattern(e.target.value); setResult(null); }}
          placeholder="{name}_{index}"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary font-mono placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="flex gap-1.5 flex-wrap">
          {TOKENS.map((token) => (
            <button
              key={token}
              onClick={() => setPattern((prev) => prev + token)}
              className="rounded-md bg-surface border border-border px-2 py-0.5 text-[10px] font-mono text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all cursor-pointer"
            >
              {token}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-muted">{t("label.rename_pattern_hint")}</p>
      </div>

      {/* Start index */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.start_index")}
        </label>
        <input
          type="number"
          min={0}
          value={startIndex}
          onChange={(e) => setStartIndex(Number(e.target.value))}
          className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Live preview */}
      {previewNames.length > 0 && (
        <div className="rounded-xl border border-glass-border bg-surface-card p-3 space-y-1.5">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            {t("label.rename_preview")}
          </span>
          {previewNames.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-text-muted truncate flex-1">{p.original}</span>
              <span className="text-text-muted shrink-0">&rarr;</span>
              <span className="text-accent font-mono truncate flex-1 text-right">{p.preview}</span>
            </div>
          ))}
          {files.length > 5 && (
            <span className="text-[10px] text-text-muted">
              ... +{files.length - 5} more
            </span>
          )}
        </div>
      )}

      <ActionButton
        onClick={handleRename}
        disabled={files.length === 0 || !pattern.trim()}
        loading={loading}
        loadingText={t("status.renaming")}
        text={t("action.bulk_rename")}
        icon={<PenLine className="h-4 w-4" />}
      />

      {/* Results */}
      {result && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.renamed", { n: result.renamed_count })}
            </span>
          </div>
          {result.results.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {result.results.slice(0, 10).map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-text-muted truncate flex-1">{entry.original_name}</span>
                  <span className="text-text-muted shrink-0">&rarr;</span>
                  <span className="text-accent font-mono truncate flex-1 text-right">{entry.new_name}</span>
                </div>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-error/80">
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
