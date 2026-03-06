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
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-300 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]",
        isDragging
          ? "border-indigo-400/30 bg-indigo-500/5 scale-[1.01]"
          : "border-black/10 dark:border-white/10 bg-black/2 dark:bg-white/2 hover:bg-black/4 dark:hover:bg-white/4 hover:border-black/15 dark:hover:border-white/15"
      )}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay rounded-2xl" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-300",
          isDragging ? "bg-indigo-500/15 text-indigo-300" : "bg-black/6 dark:bg-white/6 text-neutral-400"
        )}
      >
        <Upload className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
        {sublabel && (
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{sublabel}</p>
        )}
        <p className="mt-1.5 text-[10px] text-neutral-400 dark:text-neutral-600">
          <kbd className="rounded border border-black/8 dark:border-white/8 bg-black/4 dark:bg-white/4 px-1 py-0.5 font-mono text-[10px]">Ctrl+O</kbd>
        </p>
      </div>
    </div>
  );
}
