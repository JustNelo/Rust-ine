import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload } from "lucide-react";

interface DropZoneProps {
  accept: string;
  multiple?: boolean;
  label: string;
  sublabel?: string;
  onFilesSelected: (paths: string[]) => void;
}

export function DropZone({ accept, multiple = true, label, sublabel, onFilesSelected }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const extensions = useMemo(() => accept.split(",").map((ext) => ext.trim().toLowerCase().replace(".", "")), [accept]);

  const filterPaths = useCallback(
    (paths: string[]) => {
      const valid = paths.filter((p) => {
        const ext = p.split(".").pop()?.toLowerCase() || "";
        return extensions.includes(ext);
      });
      return multiple ? valid : valid.slice(0, 1);
    },
    [extensions, multiple],
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
      className="relative flex flex-col items-center justify-center gap-3 cursor-pointer"
      style={{
        height: 180,
        borderRadius: 12,
        border: isDragging ? "1px solid var(--indigo-glow)" : "1px dashed var(--glass-border)",
        background: isDragging ? "var(--glass-bg)" : "var(--bg-elevated)",
        boxShadow: isDragging ? "0 0 0 4px rgba(99,102,241,0.08)" : "none",
        transform: isDragging ? "scale(1.01)" : "scale(1)",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.border = "1px solid var(--indigo-core)";
          e.currentTarget.style.background = "var(--glass-bg)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.border = "1px dashed var(--glass-border)";
          e.currentTarget.style.background = "var(--bg-elevated)";
        }
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          borderRadius: 12,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
      <Upload
        style={{
          width: 28,
          height: 28,
          color: isDragging ? "var(--indigo-bright)" : "var(--indigo-muted)",
          transition: "color 150ms ease",
        }}
        strokeWidth={1.5}
      />
      <div className="text-center">
        <p style={{ fontSize: "var(--text-md)", fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        {sublabel && (
          <p style={{ marginTop: 4, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{sublabel}</p>
        )}
        <p style={{ marginTop: 6 }}>
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-border)",
              color: "var(--text-tertiary)",
              border: "none",
            }}
          >
            Ctrl+O
          </kbd>
        </p>
      </div>
    </div>
  );
}
