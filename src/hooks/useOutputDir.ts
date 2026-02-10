import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

export function useOutputDir() {
  const [outputDir, setOutputDir] = useState("");

  const selectOutputDir = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setOutputDir(selected as string);
      }
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, []);

  return { outputDir, selectOutputDir };
}
