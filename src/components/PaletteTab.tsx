import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Pipette, Copy, Check, FileJson, FileCode, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { useFileSelection } from "../hooks/useFileSelection";
import { useT } from "../i18n/i18n";
import { safeAssetUrl } from "../lib/utils";

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

type PaletteMode = "palette" | "eyedropper";

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function formatHsl(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHsl(r, g, b);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function ColorCard({
  color,
  index,
  copiedIndex,
  onCopy,
}: {
  color: ColorInfo;
  index: number;
  copiedIndex: number | null;
  onCopy: (hex: string, index: number) => void;
}) {
  const hsl = useMemo(() => formatHsl(color.r, color.g, color.b), [color.r, color.g, color.b]);

  return (
    <button
      onClick={() => onCopy(color.hex, index)}
      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-2.5 hover:bg-white/6 transition-all duration-200 cursor-pointer group"
    >
      <div
        className="h-8 w-8 rounded-lg shrink-0 border border-white/10"
        style={{ backgroundColor: color.hex }}
      />
      <div className="flex-1 text-left min-w-0">
        <p className="text-xs font-mono font-medium text-white">
          {color.hex}
        </p>
        <p className="text-[10px] text-neutral-500 truncate">
          rgb({color.r}, {color.g}, {color.b})
        </p>
        <p className="text-[10px] text-neutral-600 truncate">
          {hsl}
        </p>
        {color.percentage > 0 && (
          <p className="text-[10px] text-neutral-600">
            {color.percentage}%
          </p>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copiedIndex === index ? (
          <Check className="h-3.5 w-3.5 text-green-400" strokeWidth={1.5} />
        ) : (
          <Copy className="h-3.5 w-3.5 text-neutral-500" strokeWidth={1.5} />
        )}
      </div>
    </button>
  );
}

export function PaletteTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const [mode, setMode] = useState<PaletteMode>("palette");
  const [numColors, setNumColors] = useState(6);
  const [loading, setLoading] = useState(false);
  const [palette, setPalette] = useState<ColorInfo[]>([]);
  const [pickedColor, setPickedColor] = useState<ColorInfo | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Cleanup timer on unmount to prevent setting state on unmounted component
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setPalette([]);
    setPickedColor(null);
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setPalette([]);
    setPickedColor(null);
  }, [clearFiles]);

  // Draw image onto canvas when file changes (eyedropper mode)
  useEffect(() => {
    if (mode !== "eyedropper" || files.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const maxW = canvas.parentElement?.clientWidth || 600;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
    img.src = safeAssetUrl(files[0]);
  }, [files, mode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const [r, g, b] = pixel;
    const hex = `#${r.toString(16).padStart(2, "0").toUpperCase()}${g.toString(16).padStart(2, "0").toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`;

    setPickedColor({ hex, r, g, b, percentage: 0 });
  }, []);

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
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Fallback for environments where clipboard API isn't available
    }
  }, []);

  const copyPickedColor = useCallback(async () => {
    if (!pickedColor) return;
    try {
      await navigator.clipboard.writeText(pickedColor.hex);
      toast.success(t("toast.copied"));
    } catch {
      // ignore
    }
  }, [pickedColor, t]);

  const exportJson = useCallback(() => {
    const colors = palette.length > 0 ? palette : pickedColor ? [pickedColor] : [];
    const json = JSON.stringify(
      colors.map((c) => ({
        hex: c.hex,
        rgb: { r: c.r, g: c.g, b: c.b },
        hsl: rgbToHsl(c.r, c.g, c.b),
        percentage: c.percentage,
      })),
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
  }, [palette, pickedColor]);

  const exportCss = useCallback(() => {
    const colors = palette.length > 0 ? palette : pickedColor ? [pickedColor] : [];
    const lines = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n");
    const css = `:root {\n${lines}\n}`;
    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "palette.css";
    a.click();
    URL.revokeObjectURL(url);
  }, [palette, pickedColor]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_palette")}
        sublabel={t("dropzone.sublabel_palette")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Mode toggle */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.palette_mode")}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("palette")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 cursor-pointer ${
              mode === "palette"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-400/25"
                : "bg-white/5 border border-white/10 text-neutral-200 hover:bg-white/10 hover:border-white/20"
            }`}
          >
            <Pipette className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t("label.palette_extract")}
          </button>
          <button
            onClick={() => setMode("eyedropper")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 cursor-pointer ${
              mode === "eyedropper"
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-400/25"
                : "bg-white/5 border border-white/10 text-neutral-200 hover:bg-white/10 hover:border-white/20"
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t("label.eyedropper")}
          </button>
        </div>
      </div>

      {/* Palette extraction mode */}
      {mode === "palette" && (
        <>
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
                className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-white/8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(129,140,248,0.5)]"
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
        </>
      )}

      {/* Eyedropper mode */}
      {mode === "eyedropper" && files.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">{t("label.eyedropper_hint")}</p>
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full cursor-crosshair"
            />
          </div>

          {pickedColor && (
            <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4">
              <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
              <div className="flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-xl border border-white/10 shrink-0"
                  style={{ backgroundColor: pickedColor.hex }}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-mono font-medium text-white">{pickedColor.hex}</p>
                  <p className="text-xs font-mono text-neutral-400">
                    rgb({pickedColor.r}, {pickedColor.g}, {pickedColor.b})
                  </p>
                  <p className="text-xs font-mono text-neutral-500">
                    {formatHsl(pickedColor.r, pickedColor.g, pickedColor.b)}
                  </p>
                </div>
                <button
                  onClick={copyPickedColor}
                  className="rounded-lg bg-white/5 border border-white/10 p-2 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
                >
                  <Copy className="h-4 w-4 text-neutral-300" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Palette results */}
      {palette.length > 0 && mode === "palette" && (
        <div className="mt-4 space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 space-y-3">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
            <p className="relative text-xs font-medium text-white">
              {t("result.colors_extracted", { n: palette.length })}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {palette.map((color, index) => (
                <ColorCard
                  key={index}
                  color={color}
                  index={index}
                  copiedIndex={copiedIndex}
                  onCopy={copyHex}
                />
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
