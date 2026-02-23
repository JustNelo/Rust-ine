import { useState, useRef, useCallback, memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { X, ArrowRight } from "lucide-react";
import { formatSize } from "../../lib/utils";
import { useT } from "../../i18n/i18n";
import type { ProcessingResult } from "../../types";

interface BeforeAfterSliderProps {
  result: ProcessingResult;
  onClose: () => void;
}

export const BeforeAfterSlider = memo(function BeforeAfterSlider({
  result,
  onClose,
}: BeforeAfterSliderProps) {
  const { t } = useT();
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = useCallback(() => {
    dragging.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(2, Math.min(98, x)));
  }, []);

  const sizeDiff = result.input_size > 0
    ? ((1 - result.output_size / result.input_size) * 100)
    : 0;

  const beforeSrc = `${convertFileSrc(result.input_path)}?t=${Date.now()}`;
  const afterSrc = `${convertFileSrc(result.output_path)}?t=${Date.now()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[85vh] rounded-2xl overflow-hidden border border-glass-border bg-surface-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card border-b border-glass-border">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span className="font-medium">{t("preview.before_after")}</span>
            <span className="text-text-muted">{formatSize(result.input_size)}</span>
            <ArrowRight className="h-3 w-3 text-text-muted" />
            <span className="text-text-muted">{formatSize(result.output_size)}</span>
            {sizeDiff !== 0 && (
              <span className={sizeDiff > 0 ? "font-medium text-success" : "font-medium text-warning"}>
                {sizeDiff > 0 ? "-" : "+"}{Math.abs(sizeDiff).toFixed(1)}%
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        {/* Slider area */}
        <div
          ref={containerRef}
          className="relative select-none"
          style={{ background: "#0a0a0a", cursor: "ew-resize" }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerMove={handlePointerMove}
        >
          {/* After image (full width) */}
          <img
            src={afterSrc}
            alt="After"
            className="block max-w-[85vw] max-h-[70vh] object-contain"
            draggable={false}
          />

          {/* Before image (clipped) */}
          <div
            className="absolute top-0 left-0 bottom-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={beforeSrc}
              alt="Before"
              className="block max-w-[85vw] max-h-[70vh] object-contain"
              draggable={false}
            />
          </div>

          {/* Slider line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 border-2 border-white flex items-center justify-center shadow-lg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 3L1 7L4 11M10 3L13 7L10 11" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {t("preview.original")}
          </div>
          <div className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {t("preview.result")}
          </div>

          {/* Dimension labels */}
          {result.input_width > 0 && (
            <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white/70 backdrop-blur-sm">
              {result.input_width}×{result.input_height}
            </div>
          )}
          {result.output_width > 0 && (
            <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white/70 backdrop-blur-sm">
              {result.output_width}×{result.output_height}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
