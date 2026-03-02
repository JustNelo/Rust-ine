import { useCallback, useMemo, useState, memo } from "react";
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

  const openPreview = useCallback((filePath: string) => {
    setPreviewSrc(safeAssetUrl(filePath));
    setPreviewName(filePath.split(/[\\/]/).pop() || filePath);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewSrc(null);
    setPreviewName("");
  }, []);

  if (files.length === 0) return null;

  return (
    <>
      <div className="rounded-2xl border border-glass-border bg-surface-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            {t("label.n_files_selected", { n: files.length })}
            <span className="text-text-muted"> — {t("pdf_tool.drag_hint")}</span>
          </span>
          <button
            onClick={onClear}
            data-clear-button
            title={`${t("label.clear_all")} (Ctrl+L)`}
            className="text-xs text-text-muted hover:text-white transition-colors cursor-pointer"
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Fullscreen preview modal */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative max-w-[85vw] max-h-[85vh] rounded-2xl overflow-hidden border border-glass-border bg-surface-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card border-b border-glass-border">
              <span className="text-xs font-medium text-text-secondary truncate max-w-md">
                {previewName}
              </span>
              <button
                onClick={closePreview}
                className="rounded-full p-1 hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>
            <div className="flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
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
