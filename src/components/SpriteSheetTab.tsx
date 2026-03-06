import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, LayoutGrid, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useHistory } from "../hooks/useHistory";
import { useT } from "../i18n/i18n";

interface SpriteSheetResult {
  image_path: string;
  atlas_path: string;
  sprite_count: number;
  sheet_width: number;
  sheet_height: number;
  errors: string[];
}

export function SpriteSheetTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
  const { addEntry } = useHistory();
  const [columns, setColumns] = useState(4);
  const [padding, setPadding] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpriteSheetResult | null>(null);

  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths);
      setResult(null);
    },
    [addFiles],
  );

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleGenerate = useCallback(async () => {
    if (files.length < 2) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("spritesheet");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<SpriteSheetResult>("generate_spritesheet", {
        imagePaths: files,
        columns: columns,
        padding: padding,
        outputDir: outputDir,
      });

      setResult(res);

      const successCount = res.sprite_count > 0 ? 1 : 0;
      addEntry({
        tabId: "spritesheet",
        filesCount: files.length,
        successCount,
        failCount: res.errors.length,
        outputDir,
      });

      if (res.sprite_count > 0 && res.errors.length === 0) {
        toast.success(t("toast.spritesheet_success", { n: res.sprite_count }));
      } else if (res.sprite_count > 0) {
        toast.warning(t("toast.partial", { completed: res.sprite_count, total: files.length }));
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, columns, padding, getOutputDir, addEntry, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_spritesheet")}
        sublabel={t("dropzone.sublabel_spritesheet")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {t("label.columns")}
          </label>
          <input
            type="number"
            min={1}
            max={32}
            value={columns}
            onChange={(e) => setColumns(Number(e.target.value))}
            className="w-full rounded-lg border border-black/8 dark:border-white/8 bg-black/4 dark:bg-white/4 px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {t("label.padding")}
          </label>
          <input
            type="number"
            min={0}
            max={64}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            className="w-full rounded-lg border border-black/8 dark:border-white/8 bg-black/4 dark:bg-white/4 px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || files.length < 2}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 dark:bg-neutral-100 px-4 py-2.5 text-sm font-medium text-white dark:text-neutral-900 hover:bg-indigo-600 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.35)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
        )}
        {loading ? t("status.creating_spritesheet") : t("action.create_spritesheet")}
      </button>

      {result && result.sprite_count > 0 && (
        <div className="mt-4 relative overflow-hidden rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 space-y-3">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
          <div className="relative flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-400" strokeWidth={1.5} />
            ) : (
              <XCircle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
            )}
            <span className="text-xs font-medium text-neutral-900 dark:text-white">
              {t("result.spritesheet_created", {
                n: result.sprite_count,
                w: result.sheet_width,
                h: result.sheet_height,
              })}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-black/4 dark:bg-white/4 border border-black/8 dark:border-white/8 px-2 py-1 text-[10px] font-mono text-neutral-600 dark:text-neutral-300">
              spritesheet.png
            </span>
            <span className="rounded-md bg-black/4 dark:bg-white/4 border border-black/8 dark:border-white/8 px-2 py-1 text-[10px] font-mono text-neutral-600 dark:text-neutral-300">
              spritesheet.json
            </span>
          </div>

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
