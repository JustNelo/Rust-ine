import { useState, useCallback, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Crop, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { useFileSelection } from "../hooks/useFileSelection";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import type { BatchProgress, ProcessingResult } from "../types";

/** Rectangle in normalised image coordinates (0–1) */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move" | null;

const HANDLE_CURSORS: Record<string, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  move: "move",
};

const HANDLE_SIZE = 8; // px — hit target for edge/corner handles

/** Default crop: 80 % of the image, centred */
const DEFAULT_RECT: Rect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function CropTab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<Rect>({ ...DEFAULT_RECT });

  // Drag state — stored in refs so pointer-move doesn't trigger extra renders
  const activeHandle = useRef<Handle>(null);
  const dragOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragSelStart = useRef<Rect>({ ...DEFAULT_RECT });
  const [isDragging, setIsDragging] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  // ── File handlers ────────────────────────────────────────────────────
  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths);
      setResults([]);
      setSel({ ...DEFAULT_RECT });
      setNaturalSize(null);
    },
    [addFiles],
  );

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setResults([]);
    setSel({ ...DEFAULT_RECT });
    setNaturalSize(null);
  }, [clearFiles]);

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (img) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  const resetSelection = useCallback(() => setSel({ ...DEFAULT_RECT }), []);

  // ── Coordinate helpers ───────────────────────────────────────────────
  /** Rendered image bounds inside the object-contain container */
  const getRenderedBounds = useCallback(() => {
    const img = imgRef.current;
    if (!img || !naturalSize) return null;
    const r = img.getBoundingClientRect();
    const cW = r.width;
    const cH = r.height;
    const iA = naturalSize.w / naturalSize.h;
    const cA = cW / cH;
    let rW: number, rH: number, oX: number, oY: number;
    if (iA > cA) {
      rW = cW;
      rH = cW / iA;
      oX = 0;
      oY = (cH - rH) / 2;
    } else {
      rH = cH;
      rW = cH * iA;
      oX = (cW - rW) / 2;
      oY = 0;
    }
    return { left: r.left + oX, top: r.top + oY, width: rW, height: rH };
  }, [naturalSize]);

  /** Determine which handle (if any) sits under the pointer */
  const hitTest = useCallback(
    (clientX: number, clientY: number): Handle => {
      const b = getRenderedBounds();
      if (!b) return null;
      const px = clientX - b.left;
      const py = clientY - b.top;
      const hs = HANDLE_SIZE;

      // Selection edges in pixel-space
      const l = sel.x * b.width;
      const t = sel.y * b.height;
      const r = (sel.x + sel.w) * b.width;
      const bo = (sel.y + sel.h) * b.height;

      const nearL = Math.abs(px - l) < hs;
      const nearR = Math.abs(px - r) < hs;
      const nearT = Math.abs(py - t) < hs;
      const nearB = Math.abs(py - bo) < hs;
      const inX = px > l + hs && px < r - hs;
      const inY = py > t + hs && py < bo - hs;

      if (nearT && nearL) return "nw";
      if (nearT && nearR) return "ne";
      if (nearB && nearL) return "sw";
      if (nearB && nearR) return "se";
      if (nearT && inX) return "n";
      if (nearB && inX) return "s";
      if (nearL && inY) return "w";
      if (nearR && inY) return "e";
      if (inX && inY) return "move";
      return null;
    },
    [getRenderedBounds, sel],
  );

  // ── Pointer handlers ─────────────────────────────────────────────────
  const [cursor, setCursor] = useState("crosshair");

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const handle = hitTest(e.clientX, e.clientY);
      if (!handle) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      activeHandle.current = handle;
      dragOrigin.current = { x: e.clientX, y: e.clientY };
      dragSelStart.current = { ...sel };
      setIsDragging(true);
    },
    [hitTest, sel],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Update cursor even when not dragging
      if (!isDragging) {
        const handle = hitTest(e.clientX, e.clientY);
        setCursor(handle ? HANDLE_CURSORS[handle] : "crosshair");
        return;
      }

      const b = getRenderedBounds();
      if (!b) return;
      const dx = (e.clientX - dragOrigin.current.x) / b.width;
      const dy = (e.clientY - dragOrigin.current.y) / b.height;
      const s = dragSelStart.current;
      const h = activeHandle.current;

      let nx = s.x;
      let ny = s.y;
      let nw = s.w;
      let nh = s.h;

      if (h === "move") {
        nx = clamp(s.x + dx, 0, 1 - s.w);
        ny = clamp(s.y + dy, 0, 1 - s.h);
      } else {
        // Resize — compute new edges
        let left = s.x;
        let top = s.y;
        let right = s.x + s.w;
        let bottom = s.y + s.h;

        if (h === "nw" || h === "w" || h === "sw") left = clamp(s.x + dx, 0, right - 0.01);
        if (h === "ne" || h === "e" || h === "se") right = clamp(right + dx, left + 0.01, 1);
        if (h === "nw" || h === "n" || h === "ne") top = clamp(s.y + dy, 0, bottom - 0.01);
        if (h === "sw" || h === "s" || h === "se") bottom = clamp(bottom + dy, top + 0.01, 1);

        nx = left;
        ny = top;
        nw = right - left;
        nh = bottom - top;
      }

      setSel({ x: nx, y: ny, w: nw, h: nh });
    },
    [isDragging, hitTest, getRenderedBounds],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      activeHandle.current = null;
      setIsDragging(false);
    },
    [],
  );

  // ── Pixel values ─────────────────────────────────────────────────────
  const pixelRect = naturalSize
    ? {
        x: Math.round(sel.x * naturalSize.w),
        y: Math.round(sel.y * naturalSize.h),
        w: Math.max(1, Math.round(sel.w * naturalSize.w)),
        h: Math.max(1, Math.round(sel.h * naturalSize.h)),
      }
    : null;

  // ── Crop action ──────────────────────────────────────────────────────
  const handleCrop = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }
    if (!pixelRect || pixelRect.w === 0 || pixelRect.h === 0) {
      toast.error(t("toast.draw_crop"));
      return;
    }
    const outputDir = await getOutputDir("crop");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const result = await invoke<BatchProgress>("crop_images", {
        inputPaths: files,
        ratio: "free",
        anchor: "top-left",
        width: pixelRect.w,
        height: pixelRect.h,
        cropX: pixelRect.x,
        cropY: pixelRect.y,
        outputDir: outputDir,
      });

      setResults(result.results);

      if (result.completed === result.total) {
        toast.success(t("toast.crop_success", { n: result.completed }));
        await openOutputDir("crop");
      } else if (result.completed > 0) {
        toast.warning(
          t("toast.partial", { completed: result.completed, total: result.total }),
        );
        await openOutputDir("crop");
      } else {
        toast.error(t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${t("status.cropping")} ${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, pixelRect, getOutputDir, openOutputDir, t]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_crop")}
        sublabel={t("dropzone.sublabel_crop")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Interactive crop canvas */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {t("label.crop_draw_hint")}
            </span>
            <button
              onClick={resetSelection}
              className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              {t("label.reset")}
            </button>
          </div>

          <div
            className="relative rounded-xl overflow-hidden border border-glass-border bg-black select-none touch-none"
            style={{ cursor }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={convertFileSrc(files[0])}
              alt=""
              onLoad={handleImageLoad}
              className="w-full max-h-72 object-contain pointer-events-none"
              draggable={false}
            />

            {/* Dark overlay with cut-out */}
            {sel.w > 0 && sel.h > 0 && (
              <div
                className="absolute border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
                style={{
                  left: `${sel.x * 100}%`,
                  top: `${sel.y * 100}%`,
                  width: `${sel.w * 100}%`,
                  height: `${sel.h * 100}%`,
                }}
              >
                {/* Rule-of-thirds grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/15" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/15" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/15" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/15" />
                </div>

                {/* 8 resize handles */}
                {/* Corners */}
                <div className="absolute -top-1 -left-1 h-2.5 w-2.5 border-2 border-white bg-accent rounded-sm" />
                <div className="absolute -top-1 -right-1 h-2.5 w-2.5 border-2 border-white bg-accent rounded-sm" />
                <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 border-2 border-white bg-accent rounded-sm" />
                <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 border-2 border-white bg-accent rounded-sm" />
                {/* Edge midpoints */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-4 bg-accent rounded-full" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-4 bg-accent rounded-full" />
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-4 bg-accent rounded-full" />
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-4 bg-accent rounded-full" />
              </div>
            )}

            {/* Pixel info badge */}
            {pixelRect && (
              <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm pointer-events-none">
                {pixelRect.w} × {pixelRect.h}px
              </div>
            )}
          </div>

          {naturalSize && (
            <div className="text-[10px] text-text-muted text-right">
              {naturalSize.w} × {naturalSize.h}px
            </div>
          )}
        </div>
      )}

      <ActionButton
        onClick={handleCrop}
        disabled={files.length === 0 || !pixelRect}
        loading={loading}
        loadingText={t("status.cropping")}
        text={files.length > 0 ? t("action.crop_n", { n: files.length }) : t("action.crop")}
        icon={<Crop className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
