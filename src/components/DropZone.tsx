import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload } from "lucide-react";
import { cn } from "../lib/utils";

interface DropZoneProps {
  accept: string;
  multiple?: boolean;
  label: string;
  sublabel?: string;
  onFilesSelected: (paths: string[]) => void;
}

export function DropZone({
  accept,
  multiple = true,
  label,
  sublabel,
  onFilesSelected,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const extensions = useMemo(
    () => accept.split(",").map((ext) => ext.trim().toLowerCase().replace(".", "")),
    [accept]
  );

  const filterPaths = useCallback(
    (paths: string[]) => {
      const valid = paths.filter((p) => {
        const ext = p.split(".").pop()?.toLowerCase() || "";
        return extensions.includes(ext);
      });
      return multiple ? valid : valid.slice(0, 1);
    },
    [extensions, multiple]
  );

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragging(true);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const paths = event.payload.paths;
        const filtered = filterPaths(paths);
        if (filtered.length > 0) {
          onFilesSelected(filtered);
        }
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [filterPaths, onFilesSelected]);

  const handleClick = useCallback(async () => {
    try {
      const selected = await open({
        multiple,
        filters: [{ name: "Files", extensions }],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      onFilesSelected(paths);
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, [extensions, multiple, onFilesSelected]);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200",
        isDragging
          ? "border-[rgba(255,255,255,0.3)] bg-surface-card scale-[1.01] shadow-[0_0_20px_rgba(255,255,255,0.08)]"
          : "border-border-hover bg-[rgba(255,255,255,0.03)] hover:bg-surface-card hover:border-[rgba(255,255,255,0.25)] hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
          isDragging ? "bg-accent-muted text-white" : "bg-surface-card text-text-secondary"
        )}
      >
        <Upload className="h-6 w-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {sublabel && (
          <p className="mt-1 text-xs text-text-muted">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
