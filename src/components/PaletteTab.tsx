import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Pipette, Copy, Check, FileJson, FileCode } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { useFileSelection } from "../hooks/useFileSelection";
import { useT } from "../i18n/i18n";

interface ColorInfo {
  hex: string;
  r: number;
  g: number;
  b: number;
  percentage: number;
}

interface PaletteResult {
  colors: ColorInfo[];
  source_path: string;
}

export function PaletteTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const [numColors, setNumColors] = useState(6);
  const [loading, setLoading] = useState(false);
  const [palette, setPalette] = useState<ColorInfo[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setPalette([]);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setPalette([]);
  }, [clearFiles]);

  const handleExtract = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }

    setLoading(true);
    setPalette([]);

    try {
      const result = await invoke<PaletteResult>("extract_palette", {
        imagePath: files[0],
        numColors: numColors,
      });

      setPalette(result.colors);
      toast.success(t("toast.palette_success", { n: result.colors.length }));
    } catch (err) {
      toast.error(`${t("status.extracting_colors")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, numColors, t]);

  const copyHex = useCallback(async (hex: string, index: number) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Fallback for environments where clipboard API isn't available
    }
  }, []);

  const exportJson = useCallback(() => {
    const json = JSON.stringify(
      palette.map((c) => ({ hex: c.hex, rgb: { r: c.r, g: c.g, b: c.b }, percentage: c.percentage })),
      null,
      2
    );
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "palette.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [palette]);

  const exportCss = useCallback(() => {
    const lines = palette.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n");
    const css = `:root {\n${lines}\n}`;
    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "palette.css";
    a.click();
    URL.revokeObjectURL(url);
  }, [palette]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_palette")}
        sublabel={t("dropzone.sublabel_palette")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.num_colors")}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={3}
            max={12}
            value={numColors}
            onChange={(e) => setNumColors(Number(e.target.value))}
            className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-white/8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.15)]"
          />
          <span className="text-xs font-mono text-neutral-500 w-6 text-right">
            {numColors}
          </span>
        </div>
      </div>

      <button
        onClick={handleExtract}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.35)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <Pipette className="h-4 w-4" strokeWidth={1.5} />
        )}
        {loading ? t("status.extracting_colors") : t("action.extract_palette")}
      </button>

      {palette.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 space-y-3">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
            <p className="relative text-xs font-medium text-white">
              {t("result.colors_extracted", { n: palette.length })}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {palette.map((color, index) => (
                <button
                  key={index}
                  onClick={() => copyHex(color.hex, index)}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-2.5 hover:bg-white/6 transition-all duration-200 cursor-pointer group"
                >
                  <div
                    className="h-8 w-8 rounded-lg shrink-0 border border-white/10"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-xs font-mono font-medium text-white">
                      {color.hex}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {color.percentage}%
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedIndex === index ? (
                      <Check className="h-3.5 w-3.5 text-green-400" strokeWidth={1.5} />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-neutral-500" strokeWidth={1.5} />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Color bar preview */}
            <div className="flex h-8 rounded-lg overflow-hidden border border-white/8">
              {palette.map((color, index) => (
                <div
                  key={index}
                  className="flex-1"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportJson}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("label.export_json")}
            </button>
            <button
              onClick={exportCss}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
            >
              <FileCode className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("label.export_css")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
