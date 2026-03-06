import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { safeAssetUrl } from "../lib/utils";
import { useT } from "../i18n/i18n";
import type {
  PageThumbnail,
  PdfBuilderItem,
  MergePdfOptions,
  MergePdfResult,
  PdfExtractionResult,
  PdfWatermarkResult,
  PdfWatermarkPosition,
} from "../types";

// --- Types ---

export type PrimaryAction = "build" | "split" | "export-images" | "extract-images" | "watermark";
type ProtectMode = "protect" | "unlock";
export type ExportFormat = "png" | "jpg";
export type ExportDpi = 72 | 150 | 300;

export interface PostProcessing {
  compress: boolean;
  compressQuality: number;
  protect: boolean;
  protectPassword: string;
}

export type PipelineStep =
  | "materialize"
  | "build"
  | "split"
  | "export-images"
  | "extract-images"
  | "watermark"
  | "compress"
  | "protect";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp"]);

const THUMBNAIL_BATCH_SIZE = 30;

// Finds a unique file path by appending _2, _3, etc. if the file already exists
async function uniquePath(basePath: string): Promise<string> {
  const { exists: fsExists } = await import("@tauri-apps/plugin-fs");
  if (!(await fsExists(basePath))) return basePath;

  const dotIdx = basePath.lastIndexOf(".");
  const stem = dotIdx > 0 ? basePath.substring(0, dotIdx) : basePath;
  const ext = dotIdx > 0 ? basePath.substring(dotIdx) : "";

  let counter = 2;
  let candidate = `${stem}_${counter}${ext}`;
  while (await fsExists(candidate)) {
    counter++;
    candidate = `${stem}_${counter}${ext}`;
  }
  return candidate;
}

// Sub-folder per action inside the pdf-toolkit directory
const ACTION_SUBFOLDERS: Record<PrimaryAction | "unlock", string> = {
  build: "build",
  split: "split",
  "export-images": "exported-pages",
  "extract-images": "extracted-images",
  watermark: "watermarked",
  unlock: "unlocked",
};

function isImageFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.has(ext);
}

function isPdfFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return ext === "pdf";
}

export interface BuilderPage {
  id: string;
  sourcePath: string;
  pageNumber: number;
  sourceType: "pdf" | "image";
  thumbnailSrc: string;
  fileName: string;
  thumbnailLoaded: boolean;
}

interface PdfSplitResult {
  output_files: string[];
  errors: string[];
}

interface PdfToImagesResult {
  pdf_path: string;
  output_dir: string;
  exported_count: number;
  errors: string[];
}

interface PdfCompressResult {
  output_path: string;
  original_size: number;
  compressed_size: number;
  errors: string[];
}

interface PdfProtectResult {
  output_path: string;
  success: boolean;
  errors: string[];
}

export type WorkbenchResult =
  | { type: "build"; data: MergePdfResult; outputDir: string }
  | { type: "split"; data: PdfSplitResult; outputDir: string }
  | { type: "export-images"; data: { exported: number; errors: string[] }; outputDir: string }
  | { type: "extract-images"; data: { total_extracted: number; errors: string[] }; outputDir: string }
  | { type: "compress"; data: PdfCompressResult; outputDir: string }
  | { type: "protect"; data: PdfProtectResult; mode: ProtectMode; outputDir: string }
  | { type: "watermark"; data: PdfWatermarkResult; outputDir: string }
  | { type: "pipeline"; steps: string[]; errors: string[]; outputDir: string };

// --- Hook ---

export function usePdfWorkbench() {
  const { t } = useT();
  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [result, setResult] = useState<WorkbenchResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep | null>(null);

  // Grid modification tracking
  const [gridModified, setGridModified] = useState(false);
  const initialSnapshotRef = useRef<string>("");

  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const abortRef = useRef<AbortController | null>(null);

  // --- Snapshot: capture initial state when pages are first loaded ---
  const captureSnapshot = useCallback((pageList: BuilderPage[]) => {
    const sig = pageList.map((p) => `${p.sourcePath}:${p.pageNumber}`).join("|");
    initialSnapshotRef.current = sig;
    setGridModified(false);
  }, []);

  const checkIfModified = useCallback((pageList: BuilderPage[]) => {
    const sig = pageList.map((p) => `${p.sourcePath}:${p.pageNumber}`).join("|");
    setGridModified(sig !== initialSnapshotRef.current);
  }, []);

  // --- Detect if grid is "clean" = single PDF source, all pages, original order ---
  const getSingleSourcePdf = useCallback((): string | null => {
    const currentPages = pagesRef.current;
    if (currentPages.length === 0) return null;
    const uniqueSources = new Set(currentPages.map((p) => p.sourcePath));
    if (uniqueSources.size !== 1) return null;
    const firstPage = currentPages[0];
    if (firstPage.sourceType !== "pdf") return null;
    return firstPage.sourcePath;
  }, []);

  // --- Derive an output stem from the grid pages (original PDF name, not temp) ---
  const getOutputStem = useCallback((): string | null => {
    const currentPages = pagesRef.current;
    if (currentPages.length === 0) return null;
    // Find the first PDF source in the grid
    const firstPdf = currentPages.find((p) => p.sourceType === "pdf");
    if (firstPdf) {
      const fileName = firstPdf.sourcePath.split(/[\\/]/).pop() || "";
      const dotIdx = fileName.lastIndexOf(".");
      return dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName || null;
    }
    // Fallback: first image source name
    const first = currentPages[0];
    const fileName = first.sourcePath.split(/[\\/]/).pop() || "";
    const dotIdx = fileName.lastIndexOf(".");
    return dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName || null;
  }, []);

  // --- Page management ---

  const addFiles = useCallback(
    async (paths: string[]) => {
      setResult(null);

      // Cancel any in-progress thumbnail loading
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const imagePaths = paths.filter(isImageFile);
      const pdfPaths = paths.filter(isPdfFile);

      // Images are always added immediately → grid is dirty if pages already exist
      const willHaveMultipleSources = pagesRef.current.length > 0;

      const imagePages: BuilderPage[] = imagePaths.map((path, index) => {
        const fileName = path.split(/[\\/]/).pop() || path;
        return {
          id: `img_${Date.now()}_${index}_${fileName}`,
          sourcePath: path,
          pageNumber: 0,
          sourceType: "image" as const,
          thumbnailSrc: safeAssetUrl(path),
          fileName,
          thumbnailLoaded: true,
        };
      });

      if (imagePages.length > 0) {
        setPages((prev) => [...prev, ...imagePages]);
      }

      // For PDFs: use paginated thumbnail loading
      for (const pdfPath of pdfPaths) {
        if (controller.signal.aborted) break;
        setLoadingThumbnails(true);
        try {
          // Get page count first (instant)
          const pageCount = await invoke<number>("get_pdf_page_count", {
            pdfPath,
          });

          const fileName = pdfPath.split(/[\\/]/).pop() || pdfPath;

          // Create placeholder pages immediately
          const placeholders: BuilderPage[] = [];
          for (let i = 1; i <= pageCount; i++) {
            placeholders.push({
              id: `pdf_${fileName}_p${i}_${Date.now()}`,
              sourcePath: pdfPath,
              pageNumber: i,
              sourceType: "pdf",
              thumbnailSrc: "",
              fileName,
              thumbnailLoaded: false,
            });
          }
          setPages((prev) => [...prev, ...placeholders]);

          // Load thumbnails in batches
          for (let batch = 0; batch < pageCount; batch += THUMBNAIL_BATCH_SIZE) {
            if (controller.signal.aborted) break;
            const startPage = batch + 1;
            const maxPages = Math.min(THUMBNAIL_BATCH_SIZE, pageCount - batch);
            try {
              const thumbnails = await invoke<PageThumbnail[]>("generate_pdf_thumbnails", {
                filePaths: [pdfPath],
                startPage,
                maxPages,
              });

              // Update placeholders with real thumbnails (O(1) lookup via Map)
              const thumbMap = new Map<number, string>();
              for (const t of thumbnails) {
                if (t.source_path === pdfPath && t.thumbnail_b64) {
                  thumbMap.set(t.page_number, `data:image/jpeg;base64,${t.thumbnail_b64}`);
                }
              }
              setPages((prev) =>
                prev.map((page) => {
                  if (page.sourcePath !== pdfPath || page.thumbnailLoaded) return page;
                  const src = thumbMap.get(page.pageNumber);
                  if (src !== undefined) {
                    return { ...page, thumbnailSrc: src, thumbnailLoaded: true };
                  }
                  return page;
                }),
              );
            } catch (batchErr) {
              console.error(`Thumbnail batch error (pages ${startPage}-${startPage + maxPages}):`, batchErr);
            }
          }
        } catch (err) {
          toast.error(`Failed to load PDF: ${err}`);
        }
      }
      setLoadingThumbnails(false);

      // Capture snapshot if this is the first load, otherwise mark as dirty
      setPages((currentPages) => {
        if (!willHaveMultipleSources && pdfPaths.length <= 1 && imagePaths.length === 0) {
          // Single PDF load — capture as initial snapshot
          captureSnapshot(currentPages);
        } else if (willHaveMultipleSources || pdfPaths.length > 1 || (pdfPaths.length > 0 && imagePaths.length > 0)) {
          setGridModified(true);
        }
        return currentPages;
      });
    },
    [captureSnapshot],
  );

  const removePage = useCallback(
    (id: string) => {
      setPages((prev) => {
        const next = prev.filter((p) => p.id !== id);
        checkIfModified(next);
        return next;
      });
      setResult(null);
    },
    [checkIfModified],
  );

  const reorderPages = useCallback(
    (reordered: BuilderPage[]) => {
      setPages(reordered);
      checkIfModified(reordered);
    },
    [checkIfModified],
  );

  const clearAll = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setPages([]);
    setGridModified(false);
    initialSnapshotRef.current = "";
    setResult(null);
    setPipelineStep(null);
  }, []);

  // --- Materialize: build a temp PDF from grid pages if modified ---
  const materializeGrid = useCallback(
    async (outputDir: string): Promise<string | null> => {
      const currentPages = pagesRef.current;
      if (currentPages.length === 0) return null;

      // Fast path: single unmodified PDF → use original file directly
      if (!gridModified) {
        const singleSource = getSingleSourcePdf();
        if (singleSource) return singleSource;
      }

      setPipelineStep("materialize");

      const sep = outputDir.includes("/") ? "/" : "\\";
      const tempPath = `${outputDir}${sep}_rustine_temp_${Date.now()}.pdf`;

      const items: PdfBuilderItem[] = currentPages.map((page) => ({
        source_path: page.sourcePath,
        page_number: page.sourceType === "pdf" ? page.pageNumber : null,
        source_type: page.sourceType,
      }));

      const options: MergePdfOptions = {
        page_format: "fit",
        orientation: "portrait",
        margin_px: 0,
        image_quality: 90,
        output_path: tempPath,
      };

      const res = await invoke<MergePdfResult>("merge_to_pdf", { items, options });
      if (res.page_count === 0) {
        throw new Error(res.errors[0] || "Failed to materialize grid");
      }
      return tempPath;
    },
    [gridModified, getSingleSourcePdf],
  );

  // --- Temp file cleanup ---
  const cleanupTemp = useCallback(async (path: string | null) => {
    if (!path) return;
    // Only cleanup files we created (temp files in outputDir starting with .rustine_temp_)
    const fileName = path.split(/[\\/]/).pop() || "";
    if (fileName.startsWith("_rustine_temp_")) {
      try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        await remove(path);
      } catch {
        // Best-effort cleanup
      }
    }
  }, []);

  // --- Pipeline execution ---
  const executePipeline = useCallback(
    async (
      primaryAction: PrimaryAction,
      outputDir: string,
      actionOptions: {
        outputName?: string;
        ranges?: string;
        exportFormat?: ExportFormat;
        exportDpi?: ExportDpi;
      },
      postProcessing: PostProcessing,
    ) => {
      const currentPages = pagesRef.current;
      if (currentPages.length === 0) {
        toast.error(t("toast.select_files"));
        return;
      }

      setLoading(true);
      setResult(null);
      const pipelineErrors: string[] = [];
      const pipelineSteps: string[] = [];
      let materializedPath: string | null = null;

      const sep = outputDir.includes("/") ? "/" : "\\";

      // Ensure action-specific sub-folder exists
      const actionSubfolder = ACTION_SUBFOLDERS[primaryAction];
      const actionDir = `${outputDir}${sep}${actionSubfolder}`;
      try {
        const { mkdir, exists: fsExists } = await import("@tauri-apps/plugin-fs");
        const dirExists = await fsExists(actionDir);
        if (!dirExists) await mkdir(actionDir, { recursive: true });
      } catch (dirErr) {
        console.error("Cannot create action sub-folder:", dirErr);
      }
      const safeName = (actionOptions.outputName || "document.pdf").endsWith(".pdf")
        ? actionOptions.outputName || "document.pdf"
        : `${actionOptions.outputName || "document"}.pdf`;

      try {
        // === PRIMARY ACTION ===

        if (primaryAction === "build") {
          setPipelineStep("build");
          pipelineSteps.push("build");

          // If post-processing is needed, build to temp first; otherwise write directly
          const needsPostProcessing = postProcessing.compress || postProcessing.protect;
          const directPath = await uniquePath(`${actionDir}${sep}${safeName}`);
          const buildPath = needsPostProcessing
            ? `${outputDir}${sep}_rustine_temp_build_${Date.now()}.pdf`
            : directPath;

          const items: PdfBuilderItem[] = currentPages.map((page) => ({
            source_path: page.sourcePath,
            page_number: page.sourceType === "pdf" ? page.pageNumber : null,
            source_type: page.sourceType,
          }));

          const options: MergePdfOptions = {
            page_format: "fit",
            orientation: "portrait",
            margin_px: 0,
            image_quality: 90,
            output_path: buildPath,
          };

          const buildRes = await invoke<MergePdfResult>("merge_to_pdf", { items, options });
          if (buildRes.page_count === 0) {
            toast.error(buildRes.errors[0] || t("toast.all_failed"));
            setLoading(false);
            return;
          }

          materializedPath = buildPath;

          if (!needsPostProcessing) {
            setResult({ type: "build", data: buildRes, outputDir: actionDir });
            toast.success(t("toast.build_success", { n: buildRes.page_count }));
            setLoading(false);
            setPipelineStep(null);
            return;
          }
        } else if (primaryAction === "split") {
          // Materialize first if grid was modified
          materializedPath = await materializeGrid(outputDir);
          if (!materializedPath) {
            toast.error(t("toast.select_pdf"));
            setLoading(false);
            return;
          }

          setPipelineStep("split");
          pipelineSteps.push("split");

          const res = await invoke<PdfSplitResult>("split_pdf", {
            pdfPath: materializedPath,
            ranges: actionOptions.ranges || "1-end",
            outputDir: actionDir,
            outputStem: getOutputStem(),
          });

          await cleanupTemp(materializedPath);

          setResult({ type: "split", data: res, outputDir: actionDir });
          if (res.output_files.length > 0) {
            toast.success(t("toast.pdf_split_success", { n: res.output_files.length }));
          } else {
            toast.error(t("toast.all_failed"));
          }
          setLoading(false);
          setPipelineStep(null);
          return;
        } else if (primaryAction === "export-images") {
          materializedPath = await materializeGrid(outputDir);
          if (!materializedPath) {
            toast.error(t("toast.select_pdf"));
            setLoading(false);
            return;
          }

          setPipelineStep("export-images");
          pipelineSteps.push("export-images");

          const res = await invoke<PdfToImagesResult>("pdf_to_images", {
            pdfPath: materializedPath,
            outputDir: actionDir,
            format: actionOptions.exportFormat || "png",
            dpi: actionOptions.exportDpi || 150,
            outputStem: getOutputStem(),
          });

          await cleanupTemp(materializedPath);

          setResult({
            type: "export-images",
            data: { exported: res.exported_count, errors: res.errors },
            outputDir: actionDir,
          });
          if (res.exported_count > 0) {
            toast.success(t("toast.pdf_to_images_success", { n: res.exported_count }));
          } else {
            toast.error(t("toast.all_failed"));
          }
          setLoading(false);
          setPipelineStep(null);
          return;
        } else if (primaryAction === "extract-images") {
          materializedPath = await materializeGrid(outputDir);
          if (!materializedPath) {
            toast.error(t("toast.select_pdf"));
            setLoading(false);
            return;
          }

          setPipelineStep("extract-images");
          pipelineSteps.push("extract-images");

          const res = await invoke<PdfExtractionResult>("extract_pdf_images", {
            pdfPath: materializedPath,
            outputDir: actionDir,
            outputStem: getOutputStem(),
          });

          await cleanupTemp(materializedPath);

          setResult({
            type: "extract-images",
            data: { total_extracted: res.extracted_count, errors: res.errors },
            outputDir: actionDir,
          });
          if (res.extracted_count > 0) {
            toast.success(t("toast.extract_success", { n: res.extracted_count }));
          } else if (res.errors.length > 0) {
            toast.error(t("toast.all_failed"));
          } else {
            toast.info(t("result.no_images"));
          }
          setLoading(false);
          setPipelineStep(null);
          return;
        }

        // === POST-PROCESSING (only for Build action) ===

        const desiredPath = await uniquePath(`${actionDir}${sep}${safeName}`);

        let currentPdfPath = materializedPath!;
        const intermediates: string[] = [];

        // Compress step
        if (postProcessing.compress) {
          setPipelineStep("compress");
          pipelineSteps.push("compress");

          const compressRes = await invoke<PdfCompressResult>("compress_pdf_cmd", {
            pdfPath: currentPdfPath,
            quality: postProcessing.compressQuality,
            outputDir: actionDir,
          });

          if (compressRes.errors.length > 0 || !compressRes.output_path) {
            pipelineErrors.push(...compressRes.errors);
          } else {
            intermediates.push(currentPdfPath);
            currentPdfPath = compressRes.output_path;
          }
        }

        // Protect step
        if (postProcessing.protect && postProcessing.protectPassword.trim()) {
          setPipelineStep("protect");
          pipelineSteps.push("protect");

          const protectRes = await invoke<PdfProtectResult>("protect_pdf_cmd", {
            pdfPath: currentPdfPath,
            password: postProcessing.protectPassword,
            outputDir: actionDir,
          });

          if (!protectRes.success) {
            pipelineErrors.push(...protectRes.errors);
          } else {
            intermediates.push(currentPdfPath);
            currentPdfPath = protectRes.output_path;
          }
        }

        // Rename the final output to the user's desired name
        if (pipelineErrors.length === 0 && currentPdfPath !== desiredPath) {
          try {
            const { rename } = await import("@tauri-apps/plugin-fs");
            await rename(currentPdfPath, desiredPath);
          } catch (renameErr) {
            pipelineErrors.push(`Rename failed: ${renameErr}`);
          }
        }

        // Cleanup all intermediate temp files
        for (const tmp of intermediates) {
          await cleanupTemp(tmp);
        }

        // Pipeline result
        setResult({
          type: "pipeline",
          steps: pipelineSteps,
          errors: pipelineErrors,
          outputDir: actionDir,
        });

        if (pipelineErrors.length === 0) {
          toast.success(t("result.pipeline_complete", { steps: pipelineSteps.join(" → ") }));
        } else {
          toast.warning(
            t("toast.partial", {
              completed: pipelineSteps.length,
              total: pipelineSteps.length + pipelineErrors.length,
            }),
          );
        }
      } catch (err) {
        toast.error(`${err}`);
        // Cleanup any temp files
        if (materializedPath) {
          await cleanupTemp(materializedPath);
        }
      } finally {
        setLoading(false);
        setPipelineStep(null);
      }
    },
    [materializeGrid, cleanupTemp, getOutputStem, t],
  );

  // --- Standalone: Watermark PDF ---
  const watermarkPdf = useCallback(
    async (
      outputDir: string,
      watermarkMode: "text" | "image",
      options: {
        text?: string;
        imagePath?: string;
        position: PdfWatermarkPosition;
        opacity: number;
        fontSize?: number;
        color?: string;
        scale?: number;
      },
    ) => {
      const currentPages = pagesRef.current;
      if (currentPages.length === 0) {
        toast.error(t("toast.select_files"));
        return;
      }

      setLoading(true);
      setResult(null);
      let materializedPath: string | null = null;

      const sep = outputDir.includes("/") ? "/" : "\\";
      const actionDir = `${outputDir}${sep}${ACTION_SUBFOLDERS.watermark}`;
      try {
        const { mkdir, exists: fsExists } = await import("@tauri-apps/plugin-fs");
        const dirExists = await fsExists(actionDir);
        if (!dirExists) await mkdir(actionDir, { recursive: true });
      } catch (dirErr) {
        console.error("Cannot create watermark sub-folder:", dirErr);
      }

      try {
        materializedPath = await materializeGrid(outputDir);
        if (!materializedPath) {
          toast.error(t("toast.select_pdf"));
          setLoading(false);
          return;
        }

        setPipelineStep("watermark");

        let res: PdfWatermarkResult;

        if (watermarkMode === "text") {
          res = await invoke<PdfWatermarkResult>("watermark_pdf_text_cmd", {
            pdfPath: materializedPath,
            text: options.text || "",
            position: options.position,
            opacity: options.opacity,
            fontSize: options.fontSize || 48,
            color: options.color || "#B3B3B3",
            outputDir: actionDir,
          });
        } else {
          res = await invoke<PdfWatermarkResult>("watermark_pdf_image_cmd", {
            pdfPath: materializedPath,
            imagePath: options.imagePath || "",
            position: options.position,
            opacity: options.opacity,
            scale: options.scale || 0.25,
            outputDir: actionDir,
          });
        }

        await cleanupTemp(materializedPath);

        setResult({ type: "watermark", data: res, outputDir: actionDir });

        if (res.page_count > 0 && res.errors.length === 0) {
          toast.success(t("toast.pdf_watermark_success", { n: res.page_count }));
        } else if (res.errors.length > 0) {
          toast.error(res.errors[0]);
        } else {
          toast.error(t("toast.all_failed"));
        }
      } catch (err) {
        toast.error(`${err}`);
        if (materializedPath) {
          await cleanupTemp(materializedPath);
        }
      } finally {
        setLoading(false);
        setPipelineStep(null);
      }
    },
    [materializeGrid, cleanupTemp, t],
  );

  // --- Standalone: Unlock PDF (no grid interaction) ---
  const unlockPdf = useCallback(
    async (pdfPath: string, password: string, outputDir: string) => {
      if (!password.trim()) {
        toast.error(t("toast.enter_password"));
        return;
      }

      setLoading(true);
      setResult(null);

      // Ensure unlock sub-folder exists
      const sep = outputDir.includes("/") ? "/" : "\\";
      const unlockDir = `${outputDir}${sep}${ACTION_SUBFOLDERS.unlock}`;
      try {
        const { mkdir, exists: fsExists } = await import("@tauri-apps/plugin-fs");
        const dirExists = await fsExists(unlockDir);
        if (!dirExists) await mkdir(unlockDir, { recursive: true });
      } catch (dirErr) {
        console.error("Cannot create unlock sub-folder:", dirErr);
      }

      try {
        const res = await invoke<PdfProtectResult>("unlock_pdf_cmd", {
          pdfPath,
          password,
          outputDir: unlockDir,
        });

        setResult({ type: "protect", data: res, mode: "unlock", outputDir: unlockDir });

        if (res.success) {
          toast.success(t("toast.pdf_unlock_success"));
        } else {
          toast.error(res.errors[0] || t("toast.all_failed"));
        }
      } catch (err) {
        toast.error(`${err}`);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  return {
    // Page state
    pages,
    loading,
    loadingThumbnails,
    result,
    gridModified,
    pipelineStep,
    // Page management
    addFiles,
    removePage,
    reorderPages,
    clearAll,
    // Actions
    executePipeline,
    watermarkPdf,
    unlockPdf,
  };
}
