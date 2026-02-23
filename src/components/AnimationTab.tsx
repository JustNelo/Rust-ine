import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Film, CheckCircle, XCircle, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface AnimationResult {
  output_path: string;
  frame_count: number;
  format: string;
  errors: string[];
}

export function AnimationTab() {
  const { t } = useT();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [frames, setFrames] = useState<string[]>([]);
  const [delayMs, setDelayMs] = useState(100);
  const [loopCount, setLoopCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnimationResult | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    setFrames((prev) => [...prev, ...paths]);
    setResult(null);
  }, []);

  const moveFrame = useCallback((index: number, direction: -1 | 1) => {
    setFrames((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const removeFrame = useCallback((index: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFrames = useCallback(() => {
    setFrames([]);
    setResult(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (frames.length < 2) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("animation");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<AnimationResult>("create_gif", {
        imagePaths: frames,
        delayMs: delayMs,
        loopCount: loopCount,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.frame_count > 0 && res.errors.length === 0) {
        toast.success(t("toast.animation_success", { frames: res.frame_count }));
        await openOutputDir("animation");
      } else if (res.frame_count > 0) {
        toast.warning(t("toast.partial", { completed: res.frame_count, total: frames.length }));
        await openOutputDir("animation");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [frames, delayMs, loopCount, getOutputDir, openOutputDir, t]);

  const getFilename = (path: string) => {
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_animation")}
        sublabel={t("dropzone.sublabel_animation")}
        onFilesSelected={handleFilesSelected}
      />

      {frames.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">
              {t("result.files_selected", { n: frames.length })}
            </p>
            <button
              onClick={clearFrames}
              className="text-[10px] text-text-muted hover:text-error transition-colors cursor-pointer"
            >
              {t("label.clear_all")}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border bg-surface-card p-2">
            {frames.map((path, index) => (
              <div
                key={`${path}-${index}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-secondary bg-surface hover:bg-surface-hover transition-colors group"
              >
                <span className="text-[10px] font-mono text-text-muted w-5 text-right shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 truncate">{getFilename(path)}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveFrame(index, -1)}
                    disabled={index === 0}
                    className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveFrame(index, 1)}
                    disabled={index === frames.length - 1}
                    className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeFrame(index)}
                    className="p-0.5 rounded hover:bg-surface-hover text-text-muted hover:text-error cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            {t("label.frame_delay")}
          </label>
          <input
            type="number"
            min={10}
            max={5000}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            {t("label.loop_count")}
          </label>
          <input
            type="number"
            min={0}
            max={9999}
            value={loopCount}
            onChange={(e) => setLoopCount(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading || frames.length < 2}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Film className="h-4 w-4" />
        )}
        {loading ? t("status.creating_animation") : t("action.create_animation")}
      </button>

      {result && result.frame_count > 0 && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-medium text-text-primary">
              {t("result.animation_created", { frames: result.frame_count, format: "GIF" })}
            </span>
          </div>
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
