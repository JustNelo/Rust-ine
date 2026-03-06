import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileImage, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ActionButton } from "./ui/ActionButton";
import { Slider } from "./ui/Slider";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useHistory } from "../hooks/useHistory";
import { useT } from "../i18n/i18n";

interface SvgRasterizeResult {
  output_path: string;
  width: number;
  height: number;
}

type SvgOutputFormat = "png" | "webp";

export function SvgRasterizeTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const { getOutputDir } = useWorkspace();
  const { addEntry } = useHistory();
  const [targetWidth, setTargetWidth] = useState(1024);
  const [outputFormat, setOutputFormat] = useState<SvgOutputFormat>("png");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SvgRasterizeResult | null>(null);
  const [lastOutputDir, setLastOutputDir] = useState("");

  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths.slice(0, 1));
      setResult(null);
    },
    [addFiles],
  );

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResult(null);
  }, [clearFiles]);

  const handleRasterize = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }
    const outputDir = await getOutputDir("svg-rasterize");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);
    setLastOutputDir(outputDir);

    try {
      const res = await invoke<SvgRasterizeResult>("rasterize_svg_cmd", {
        inputPath: files[0],
        targetWidth,
        outputFormat,
        outputDir,
      });

      setResult(res);
      addEntry({ tabId: "svg-rasterize", filesCount: 1, successCount: 1, failCount: 0, outputDir });
      toast.success(t("toast.svg_rasterize_success", { w: res.width, h: res.height }));
    } catch (err) {
      toast.error(`${t("status.rasterizing")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, targetWidth, outputFormat, getOutputDir, addEntry, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="svg"
        multiple={false}
        label={t("dropzone.svg_rasterize")}
        sublabel={t("dropzone.sublabel_svg_rasterize")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {t("label.output_format")}
        </label>
        <div className="flex gap-2">
          {(["png", "webp"] as SvgOutputFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setOutputFormat(f)}
              className={`btn-toggle ${outputFormat === f ? "btn-toggle-active" : ""}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label={t("label.target_width")}
        value={targetWidth}
        min={16}
        max={4096}
        leftHint="16px"
        rightHint="4096px"
        onChange={setTargetWidth}
      />

      <ActionButton
        onClick={handleRasterize}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.rasterizing")}
        text={t("action.rasterize_svg")}
        icon={<FileImage className="h-4 w-4" strokeWidth={1.5} />}
      />

      {result && (
        <div className="relative overflow-hidden rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 space-y-2">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-900 dark:text-white">
              {t("result.svg_rasterized", { w: result.width, h: result.height })}
            </p>
            {lastOutputDir && (
              <button
                onClick={() => revealItemInDir(lastOutputDir)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 hover:bg-black/4 dark:hover:bg-white/4 hover:text-neutral-900 dark:hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <FolderOpen className="h-3 w-3" strokeWidth={1.5} />
                {t("label.open_output_folder")}
              </button>
            )}
          </div>
          <p className="text-[10px] text-neutral-500 truncate">{result.output_path}</p>
        </div>
      )}
    </div>
  );
}
