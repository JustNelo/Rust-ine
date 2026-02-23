import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { mkdir, exists } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { TabId } from "../types";

const STORAGE_KEY = "rustine_workspace";

const SUB_FOLDERS: Partial<Record<TabId, string>> = {
  compress: "compressed",
  convert: "converted",
  resize: "resized",
  watermark: "watermarked",
  strip: "stripped",
  optimize: "optimized",
  crop: "cropped",
  pdf: "pdf-extracted",
  "pdf-builder": "pdf-built",
  palette: "palettes",
  "pdf-to-images": "pdf-pages",
  "pdf-split": "pdf-split",
  "pdf-compress": "pdf-compressed",
  favicon: "favicons",
  animation: "animations",
  spritesheet: "spritesheets",
  "pdf-protect": "pdf-protected",
  base64: "base64",
  qrcode: "qrcodes",
  "bulk-rename": "renamed",
};

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const selectWorkspace = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        const dir = selected as string;
        setWorkspace(dir);
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

  const getOutputDir = useCallback(
    async (tabId: TabId): Promise<string> => {
      if (!workspace) return "";
      const sep = workspace.includes("/") ? "/" : "\\";
      const subFolder = SUB_FOLDERS[tabId];
      const outputDir = `${workspace}${sep}${subFolder}`;

      try {
        const dirExists = await exists(outputDir);
        if (!dirExists) {
          await mkdir(outputDir, { recursive: true });
        }
      } catch (err) {
        console.error("Cannot create output dir:", err);
      }

      return outputDir;
    },
    [workspace]
  );

  const openInExplorer = useCallback(async () => {
    if (!workspace) return;
    try {
      await revealItemInDir(workspace);
    } catch (err) {
      console.error("Cannot open explorer:", err);
    }
  }, [workspace]);

  const openOutputDir = useCallback(
    async (tabId: TabId) => {
      if (!workspace) return;
      const sep = workspace.includes("/") ? "/" : "\\";
      const subFolder = SUB_FOLDERS[tabId];
      const outputDir = `${workspace}${sep}${subFolder}`;
      try {
        await revealItemInDir(outputDir);
      } catch (err) {
        console.error("Cannot open output dir:", err);
      }
    },
    [workspace]
  );

  return { workspace, selectWorkspace, getOutputDir, openInExplorer, openOutputDir };
}
