import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, FileText, Image } from "lucide-react";
import type { BuilderPage } from "../hooks/usePdfBuilder";

interface PdfPageCardProps {
  page: BuilderPage;
  onRemove: (id: string) => void;
}

export function PdfPageCard({ page, onRemove }: PdfPageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative rounded-xl overflow-hidden border border-glass-border bg-accent/2 aspect-3/4 flex flex-col cursor-grab active:cursor-grabbing"
    >
      {/* Remove button — stops drag activation */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(page.id)}
        className="absolute top-1.5 right-1.5 z-10 rounded-full bg-red-600/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500"
      >
        <X className="h-3 w-3 text-white" />
      </button>

      {/* Type badge */}
      <div className="absolute top-1.5 left-1.5 z-10">
        <span className="inline-flex items-center gap-0.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
          {page.sourceType === "pdf" ? (
            <>
              <FileText className="h-2.5 w-2.5" />
              PDF
            </>
          ) : (
            <>
              <Image className="h-2.5 w-2.5" />
              IMG
            </>
          )}
        </span>
      </div>

      {/* Thumbnail */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {page.thumbnailSrc ? (
          <img
            src={page.thumbnailSrc}
            alt={page.fileName}
            loading="lazy"
            className="h-full w-full object-cover"
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <FileText className="h-8 w-8 text-text-muted" />
        )}
      </div>

      {/* Info bar */}
      <div className="bg-black/50 px-2 py-1.5 backdrop-blur-sm">
        <p className="text-[10px] text-white/90 truncate font-medium">{page.fileName}</p>
        {page.sourceType === "pdf" && page.pageNumber > 0 && (
          <p className="text-[9px] text-white/50">Page {page.pageNumber}</p>
        )}
      </div>
    </div>
  );
}
