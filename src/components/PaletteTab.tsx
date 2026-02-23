import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Pipette, Copy, Check, FileJson, FileCode } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
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
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
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

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.num_colors")}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={3}
            max={12}
            value={numColors}
            onChange={(e) => setNumColors(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-xs font-mono text-text-muted w-6 text-right">
            {numColors}
          </span>
        </div>
      </div>

      <button
        onClick={handleExtract}
        disabled={loading || files.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_20px_rgba(108,108,237,0.3)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Pipette className="h-4 w-4" />
        )}
        {loading ? t("status.extracting_colors") : t("action.extract_palette")}
      </button>

      {palette.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-glass-border bg-surface-card p-4 space-y-3">
            <p className="text-xs font-medium text-text-primary">
              {t("result.colors_extracted", { n: palette.length })}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {palette.map((color, index) => (
                <button
                  key={index}
                  onClick={() => copyHex(color.hex, index)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 hover:bg-surface-hover transition-all cursor-pointer group"
                >
                  <div
                    className="h-8 w-8 rounded-lg shrink-0 border border-white/10"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-xs font-mono font-medium text-text-primary">
                      {color.hex}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {color.percentage}%
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedIndex === index ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-text-muted" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Color bar preview */}
            <div className="flex h-8 rounded-lg overflow-hidden border border-border">
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
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-all cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5" />
              {t("label.export_json")}
            </button>
            <button
              onClick={exportCss}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-all cursor-pointer"
            >
              <FileCode className="h-3.5 w-3.5" />
              {t("label.export_css")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
