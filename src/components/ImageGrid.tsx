import { useCallback, useMemo, useState, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useT } from "../i18n/i18n";
import { safeAssetUrl } from "../lib/utils";
import { ImageGridCard } from "./ImageGridCard";
import { MetadataPanel } from "./MetadataPanel";
import type { ImageMetadata } from "../types";

interface ImageGridProps {
  files: string[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

const MEASURING_CONFIG = {
  droppable: { strategy: MeasuringStrategy.BeforeDragging },
};

const CARD_MIN_W = 100;

export const ImageGrid = memo(function ImageGrid({
  files,
  onReorder,
  onRemove,
  onClear,
}: ImageGridProps) {
  const { t } = useT();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Stable IDs for DnD — use path + index to ensure uniqueness
  const itemIds = useMemo(
    () => files.map((f, i) => `${i}::${f}`),
    [files]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = itemIds.indexOf(active.id as string);
        const newIndex = itemIds.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(oldIndex, newIndex);
        }
      }
    },
    [itemIds, onReorder]
  );

  const [infoMetadata, setInfoMetadata] = useState<ImageMetadata | null>(null);

  const openPreview = useCallback((filePath: string) => {
    setPreviewSrc(safeAssetUrl(filePath));
    setPreviewName(filePath.split(/[\\/]/).pop() || filePath);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewSrc(null);
    setPreviewName("");
  }, []);

  const openInfo = useCallback(async (filePath: string) => {
    try {
      const meta = await invoke<ImageMetadata>("read_metadata", { filePath });
      setInfoMetadata(meta);
    } catch {
      // silently ignore files that cannot be read
    }
  }, []);

  const closeInfo = useCallback(() => {
    setInfoMetadata(null);
  }, []);

  if (files.length === 0) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-3 space-y-3">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
        <div className="relative flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {t("label.n_files_selected", { n: files.length })}
            <span className="text-neutral-500"> — {t("pdf_tool.drag_hint")}</span>
          </span>
          <button
            onClick={onClear}
            data-clear-button
            title={`${t("label.clear_all")} (Ctrl+L)`}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors duration-200 cursor-pointer"
          >
            {t("label.clear_all")}
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          measuring={MEASURING_CONFIG}
        >
          <SortableContext items={itemIds} strategy={rectSortingStrategy}>
            <div
              className="max-h-64 overflow-y-auto pr-1"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_W}px, 1fr))`,
                gap: "6px",
              }}
            >
              {files.map((file, index) => (
                <ImageGridCard
                  key={itemIds[index]}
                  id={itemIds[index]}
                  filePath={file}
                  index={index}
                  onRemove={onRemove}
                  onPreview={openPreview}
                  onInfo={openInfo}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Info modal */}
      {infoMetadata && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm"
          onClick={closeInfo}
        >
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden border border-black/8 dark:border-white/8 bg-white/90 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                {t("info.image_details")}
              </span>
              <button
                onClick={closeInfo}
                className="rounded-full p-1 hover:bg-black/6 dark:hover:bg-white/6 transition-colors duration-200 cursor-pointer"
              >
                <X className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
              </button>
            </div>
            <MetadataPanel metadata={infoMetadata} />
          </div>
        </div>
      )}

      {/* Fullscreen preview modal */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative max-w-[85vw] max-h-[85vh] rounded-2xl overflow-hidden border border-black/8 dark:border-white/8 bg-white/90 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/8 dark:border-white/8">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 truncate max-w-md">
                {previewName}
              </span>
              <button
                onClick={closePreview}
                className="rounded-full p-1 hover:bg-black/6 dark:hover:bg-white/6 transition-colors duration-200 cursor-pointer"
              >
                <X className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex items-center justify-center p-4 bg-neutral-100 dark:bg-neutral-950">
              <img
                src={previewSrc}
                alt={previewName}
                className="max-w-full max-h-[75vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
