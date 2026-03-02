import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, ZoomIn } from "lucide-react";
import { safeAssetUrl } from "../lib/utils";

interface ImageGridCardProps {
  id: string;
  filePath: string;
  onRemove: (index: number) => void;
  index: number;
  onPreview: (filePath: string) => void;
}

export const ImageGridCard = memo(function ImageGridCard({
  id,
  filePath,
  onRemove,
  index,
  onPreview,
}: ImageGridCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : ("auto" as const),
  };

  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const ext = fileName.split(".").pop()?.toUpperCase() || "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative aspect-square rounded-xl overflow-hidden border border-glass-border bg-surface-card cursor-grab active:cursor-grabbing"
    >
      {/* Remove button */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(index)}
        className="absolute top-1 right-1 z-10 rounded-full bg-red-600/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500"
      >
        <X className="h-3 w-3 text-white" />
      </button>

      {/* Preview button */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onPreview(filePath)}
        className="absolute top-1 left-1 z-10 rounded-full bg-black/50 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/70 backdrop-blur-sm"
      >
        <ZoomIn className="h-3 w-3 text-white" />
      </button>

      {/* Thumbnail */}
      <img
        src={safeAssetUrl(filePath)}
        alt={fileName}
        loading="lazy"
        draggable={false}
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Info bar */}
      <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/70 to-transparent px-1.5 py-1">
        <p className="text-[9px] text-white/90 truncate font-medium leading-tight">
          {fileName}
        </p>
        {ext && (
          <span className="text-[8px] text-white/50 leading-tight">{ext}</span>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.filePath === next.filePath &&
    prev.index === next.index &&
    prev.onRemove === next.onRemove &&
    prev.onPreview === next.onPreview
  );
});
