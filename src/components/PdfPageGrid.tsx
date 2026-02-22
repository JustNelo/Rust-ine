import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";
import { PdfPageCard } from "./PdfPageCard";
import type { BuilderPage } from "../hooks/usePdfBuilder";

interface PdfPageGridProps {
  pages: BuilderPage[];
  loadingThumbnails: boolean;
  onReorder: (pages: BuilderPage[]) => void;
  onRemove: (id: string) => void;
}

export function PdfPageGrid({
  pages,
  loadingThumbnails,
  onReorder,
  onRemove,
}: PdfPageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = pages.findIndex((p) => p.id === active.id);
        const newIndex = pages.findIndex((p) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(arrayMove(pages, oldIndex, newIndex));
        }
      }
    },
    [pages, onReorder]
  );

  if (pages.length === 0 && !loadingThumbnails) return null;

  return (
    <div className="rounded-2xl border border-glass-border bg-surface-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          {pages.length} page{pages.length !== 1 ? "s" : ""} — drag to reorder
        </span>
        {loadingThumbnails && (
          <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading pages...
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-3 gap-3 max-h-112 overflow-y-auto pr-1">
            {pages.map((page) => (
              <PdfPageCard
                key={page.id}
                page={page}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
