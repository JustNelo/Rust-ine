import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Film, CheckCircle, XCircle, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ActionButton } from "./ui/ActionButton";
import { useWorkspace } from "../hooks/useWorkspace";
import { useHistory } from "../hooks/useHistory";
import { useT } from "../i18n/i18n";
import { safeAssetUrl } from "../lib/utils";

interface AnimationResult {
  output_path: string;
  frame_count: number;
  format: string;
  errors: string[];
}

export function AnimationTab() {
  const { t } = useT();
  const { getOutputDir } = useWorkspace();
  const { addEntry } = useHistory();
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

      const successCount = res.frame_count > 0 ? 1 : 0;
      addEntry({ tabId: "animation", filesCount: frames.length, successCount, failCount: res.errors.length, outputDir });

      if (res.frame_count > 0 && res.errors.length === 0) {
        toast.success(t("toast.animation_success", { frames: res.frame_count }));
      } else if (res.frame_count > 0) {
        toast.warning(t("toast.partial", { completed: res.frame_count, total: frames.length }));
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [frames, delayMs, loopCount, getOutputDir, addEntry, t]);

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
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {t("result.files_selected", { n: frames.length })}
            </p>
            <button
              onClick={clearFrames}
              className="text-[10px] text-neutral-500 hover:text-red-400 transition-colors duration-200 cursor-pointer"
            >
              {t("label.clear_all")}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 backdrop-blur-xl p-2">
            {frames.map((path, index) => (
              <div
                key={`${path}-${index}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 bg-black/3 dark:bg-white/3 hover:bg-black/6 dark:hover:bg-white/6 transition-colors duration-200 group"
              >
                <span className="text-[10px] font-mono text-neutral-500 w-5 text-right shrink-0">
                  {index + 1}
                </span>
                <img
                  src={safeAssetUrl(path)}
                  alt=""
                  className="h-7 w-7 rounded object-cover shrink-0 border border-black/8 dark:border-white/8"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="flex-1 truncate">{getFilename(path)}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveFrame(index, -1)}
                    disabled={index === 0}
                    className="p-0.5 rounded hover:bg-black/6 dark:hover:bg-white/6 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => moveFrame(index, 1)}
                    disabled={index === frames.length - 1}
                    className="p-0.5 rounded hover:bg-black/6 dark:hover:bg-white/6 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => removeFrame(index)}
                    className="p-0.5 rounded hover:bg-black/6 dark:hover:bg-white/6 text-neutral-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {t("label.frame_delay")}
          </label>
          <input
            type="number"
            min={10}
            max={5000}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="w-full rounded-lg border border-black/8 dark:border-white/8 bg-black/4 dark:bg-white/4 px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {t("label.loop_count")}
          </label>
          <input
            type="number"
            min={0}
            max={9999}
            value={loopCount}
            onChange={(e) => setLoopCount(Number(e.target.value))}
            className="w-full rounded-lg border border-black/8 dark:border-white/8 bg-black/4 dark:bg-white/4 px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
          />
        </div>
      </div>

      <ActionButton
        onClick={handleCreate}
        disabled={frames.length < 2}
        loading={loading}
        loadingText={t("status.creating_animation")}
        text={t("action.create_animation")}
        icon={<Film className="h-4 w-4" strokeWidth={1.5} />}
      />

      {result && result.frame_count > 0 && (
        <div className="mt-4 relative overflow-hidden rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 space-y-2">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
          <div className="relative flex items-center gap-2">
            {result.errors.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-400" strokeWidth={1.5} />
            ) : (
              <XCircle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
            )}
            <span className="text-xs font-medium text-neutral-900 dark:text-white">
              {t("result.animation_created", { frames: result.frame_count, format: "GIF" })}
            </span>
          </div>
          {/* GIF preview */}
          {result.output_path && (
            <div className="rounded-xl overflow-hidden border border-black/8 dark:border-white/8 bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center max-h-48">
              <img
                src={safeAssetUrl(result.output_path, true)}
                alt="Generated GIF"
                className="max-h-48 object-contain"
              />
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
