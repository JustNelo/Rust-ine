import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

const STORAGE_KEY = "rustine_output_dir";

export function useOutputDir() {
  const [outputDir, setOutputDir] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const selectOutputDir = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const dir = selected as string;
        setOutputDir(dir);
        try {
          localStorage.setItem(STORAGE_KEY, dir);
        } catch {
          // localStorage may be unavailable
        }
      }
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, []);

  return { outputDir, selectOutputDir };
}
