import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { TabId } from "../types";

interface UseGlobalShortcutsOptions {
  acceptExtensions: string[];
  onFilesSelected: (paths: string[]) => void;
  allTabIds?: TabId[];
  onSwitchTab?: (tabId: TabId) => void;
}

export function useGlobalShortcuts({
  acceptExtensions,
  onFilesSelected,
  allTabIds,
  onSwitchTab,
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

      // Ctrl+1-9 — switch tabs
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9 && allTabIds && onSwitchTab) {
        e.preventDefault();
        const idx = digit - 1;
        if (idx < allTabIds.length) {
          onSwitchTab(allTabIds[idx]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [acceptExtensions, onFilesSelected, allTabIds, onSwitchTab]);
}
