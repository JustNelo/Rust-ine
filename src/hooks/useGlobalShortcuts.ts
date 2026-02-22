import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface UseGlobalShortcutsOptions {
  acceptExtensions: string[];
  onFilesSelected: (paths: string[]) => void;
}

export function useGlobalShortcuts({
  acceptExtensions,
  onFilesSelected,
}: UseGlobalShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        try {
          const selected = await open({
            multiple: true,
            filters: [{ name: "Files", extensions: acceptExtensions }],
          });
          if (!selected) return;
          const paths = Array.isArray(selected) ? selected : [selected];
          if (paths.length > 0) {
            onFilesSelected(paths);
          }
        } catch (err) {
          console.error("Shortcut file open error:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [acceptExtensions, onFilesSelected]);
}
