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
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Ctrl+O — open file dialog
      if (e.key === "o") {
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
        return;
      }

      // Ctrl+Enter — click the active action button
      if (e.key === "Enter") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>("[data-action-button]");
        if (btn && !btn.disabled) btn.click();
        return;
      }

      // Ctrl+L — clear files
      if (e.key === "l") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>("[data-clear-button]");
        if (btn) btn.click();
        return;
      }

      // Escape — cancel ongoing processing
      if (e.key === "Escape") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>("[data-cancel-button]");
        if (btn) btn.click();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [acceptExtensions, onFilesSelected]);
}
