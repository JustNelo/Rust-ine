import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PenLine, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ActionButton } from "./ui/ActionButton";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useHistory } from "../hooks/useHistory";
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
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
  const { addEntry } = useHistory();
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

      addEntry({ tabId: "bulk-rename", filesCount: files.length, successCount: res.renamed_count, failCount: res.errors.length, outputDir });

      if (res.renamed_count > 0 && res.errors.length === 0) {
        toast.success(t("toast.rename_success", { n: res.renamed_count }));
      } else if (res.renamed_count > 0) {
        toast.warning(t("toast.partial", { completed: res.renamed_count, total: files.length }));
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, pattern, startIndex, getOutputDir, addEntry, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp,gif,ico,svg"
        label={t("dropzone.images_bulk_rename")}
        sublabel={t("dropzone.sublabel_bulk_rename")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Pattern input */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.rename_pattern")}
        </label>
        <input
          type="text"
          value={pattern}
          onChange={(e) => { setPattern(e.target.value); setResult(null); }}
          placeholder="{name}_{index}"
          className="w-full rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-xs text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
        />
        <div className="flex gap-1.5 flex-wrap">
          {TOKENS.map((token) => (
            <button
              key={token}
              onClick={() => setPattern((prev) => prev + token)}
              className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-neutral-500 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
            >
              {token}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-neutral-500">{t("label.rename_pattern_hint")}</p>
      </div>

      {/* Start index */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.start_index")}
        </label>
        <input
          type="number"
          min={0}
          value={startIndex}
          onChange={(e) => setStartIndex(Number(e.target.value))}
          className="w-20 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
        />
      </div>

      {/* Live preview */}
      {previewNames.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/2 backdrop-blur-xl p-3 space-y-1.5">
          <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
            {t("label.rename_preview")}
          </span>
          {previewNames.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-neutral-500 truncate flex-1">{p.original}</span>
              <span className="text-neutral-500 shrink-0">&rarr;</span>
              <span className="text-white font-mono truncate flex-1 text-right">{p.preview}</span>
            </div>
          ))}
          {files.length > 5 && (
            <span className="text-[10px] text-neutral-500">
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
        icon={<PenLine className="h-4 w-4" strokeWidth={1.5} />}
      />

      {/* Results */}
      {result && (
        <div className="mt-4 relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 space-y-2">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
          <div className="relative flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-400" strokeWidth={1.5} />
            ) : (
              <XCircle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
            )}
            <span className="text-xs font-medium text-white">
              {t("result.renamed", { n: result.renamed_count })}
            </span>
          </div>
          {result.results.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {result.results.slice(0, 10).map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-neutral-500 truncate flex-1">{entry.original_name}</span>
                  <span className="text-neutral-500 shrink-0">&rarr;</span>
                  <span className="text-white font-mono truncate flex-1 text-right">{entry.new_name}</span>
                </div>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-400/80">
                  <XCircle className="h-3 w-3 shrink-0 mt-0.5" strokeWidth={1.5} />
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
