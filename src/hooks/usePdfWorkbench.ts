import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { safeAssetUrl } from "../lib/utils";
import type {
  PageThumbnail,
  PdfBuilderItem,
  MergePdfOptions,
  MergePdfResult,
  PdfExtractionResult,
} from "../types";

// --- Types ---

export type PrimaryAction = "build" | "split" | "export-images" | "extract-images";
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
  | "compress"
  | "protect";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp",
]);

const THUMBNAIL_BATCH_SIZE = 30;

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
  | { type: "build"; data: MergePdfResult }
  | { type: "split"; data: PdfSplitResult }
  | { type: "export-images"; data: { exported: number; errors: string[] } }
  | { type: "extract-images"; data: { total_extracted: number; errors: string[] } }
  | { type: "compress"; data: PdfCompressResult }
  | { type: "protect"; data: PdfProtectResult; mode: ProtectMode }
  | { type: "pipeline"; steps: string[]; errors: string[] };

// --- Hook ---

export function usePdfWorkbench() {
  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [result, setResult] = useState<WorkbenchResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep | null>(null);

  // Grid modification tracking
  const [gridModified, setGridModified] = useState(false);
  const initialSnapshotRef = useRef<string>("");

  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

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

  // --- Page management ---

  const addFiles = useCallback(async (paths: string[]) => {
    setResult(null);
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
          const startPage = batch + 1;
          const maxPages = Math.min(THUMBNAIL_BATCH_SIZE, pageCount - batch);
          try {
            const thumbnails = await invoke<PageThumbnail[]>(
              "generate_pdf_thumbnails",
              {
                filePaths: [pdfPath],
                startPage,
                maxPages,
              }
            );

            // Update placeholders with real thumbnails
            setPages((prev) =>
              prev.map((page) => {
                if (page.sourcePath !== pdfPath || page.thumbnailLoaded) return page;
                const match = thumbnails.find(
                  (t) =>
                    t.source_path === pdfPath &&
                    t.page_number === page.pageNumber
                );
                if (match) {
                  return {
                    ...page,
                    thumbnailSrc: match.thumbnail_b64
                      ? `data:image/jpeg;base64,${match.thumbnail_b64}`
                      : "",
                    thumbnailLoaded: true,
                  };
                }
                return page;
              })
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
  }, [captureSnapshot]);

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      checkIfModified(next);
      return next;
    });
    setResult(null);
  }, [checkIfModified]);

  const reorderPages = useCallback((reordered: BuilderPage[]) => {
    setPages(reordered);
    checkIfModified(reordered);
  }, [checkIfModified]);

  const clearAll = useCallback(() => {
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
    [gridModified, getSingleSourcePdf]
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
      openOutputDir: () => Promise<void>,
      actionOptions: {
        outputName?: string;
        ranges?: string;
        exportFormat?: ExportFormat;
        exportDpi?: ExportDpi;
      },
      postProcessing: PostProcessing
    ) => {
      const currentPages = pagesRef.current;
      if (currentPages.length === 0) {
        toast.error("Please add at least one file.");
        return;
      }

      setLoading(true);
      setResult(null);
      const pipelineErrors: string[] = [];
      const pipelineSteps: string[] = [];
      let materializedPath: string | null = null;

      const sep = outputDir.includes("/") ? "/" : "\\";
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
          const buildPath = needsPostProcessing
            ? `${outputDir}${sep}_rustine_temp_build_${Date.now()}.pdf`
            : `${outputDir}${sep}${safeName}`;

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
            toast.error(buildRes.errors[0] || "Build failed.");
            setLoading(false);
            return;
          }

          materializedPath = buildPath;

          if (!needsPostProcessing) {
            setResult({ type: "build", data: buildRes });
            toast.success(`PDF created with ${buildRes.page_count} page(s)!`);
            await openOutputDir();
            setLoading(false);
            setPipelineStep(null);
            return;
          }

        } else if (primaryAction === "split") {
          // Materialize first if grid was modified
          materializedPath = await materializeGrid(outputDir);
          if (!materializedPath) {
            toast.error("No PDF to split.");
            setLoading(false);
            return;
          }

          setPipelineStep("split");
          pipelineSteps.push("split");

          const res = await invoke<PdfSplitResult>("split_pdf", {
            pdfPath: materializedPath,
            ranges: actionOptions.ranges || "1-end",
            outputDir,
          });

          await cleanupTemp(materializedPath);

          setResult({ type: "split", data: res });
          if (res.output_files.length > 0) {
            toast.success(`PDF split into ${res.output_files.length} file(s)!`);
            await openOutputDir();
          } else {
            toast.error("Split failed.");
          }
          setLoading(false);
          setPipelineStep(null);
          return;

        } else if (primaryAction === "export-images") {
          materializedPath = await materializeGrid(outputDir);
          if (!materializedPath) {
            toast.error("No PDF to export.");
            setLoading(false);
            return;
          }

          setPipelineStep("export-images");
          pipelineSteps.push("export-images");

          const res = await invoke<PdfToImagesResult>("pdf_to_images", {
            pdfPath: materializedPath,
            outputDir,
            format: actionOptions.exportFormat || "png",
            dpi: actionOptions.exportDpi || 150,
          });

          await cleanupTemp(materializedPath);

          setResult({
            type: "export-images",
            data: { exported: res.exported_count, errors: res.errors },
          });
          if (res.exported_count > 0) {
            toast.success(`${res.exported_count} page(s) exported!`);
            await openOutputDir();
          } else {
            toast.error("Export failed.");
          }
          setLoading(false);
          setPipelineStep(null);
          return;

        } else if (primaryAction === "extract-images") {
          materializedPath = await materializeGrid(outputDir);
          if (!materializedPath) {
            toast.error("No PDF to extract from.");
            setLoading(false);
            return;
          }

          setPipelineStep("extract-images");
          pipelineSteps.push("extract-images");

          const res = await invoke<PdfExtractionResult>("extract_pdf_images", {
            pdfPath: materializedPath,
            outputDir,
          });

          await cleanupTemp(materializedPath);

          setResult({
            type: "extract-images",
            data: { total_extracted: res.extracted_count, errors: res.errors },
          });
          if (res.extracted_count > 0) {
            toast.success(`${res.extracted_count} image(s) extracted!`);
            await openOutputDir();
          } else if (res.errors.length > 0) {
            toast.error("Extraction failed.");
          } else {
            toast.info("No embedded images found.");
          }
          setLoading(false);
          setPipelineStep(null);
          return;
        }

        // === POST-PROCESSING (only for Build action) ===

        const desiredPath = `${outputDir}${sep}${safeName}`;

        let currentPdfPath = materializedPath!;
        const intermediates: string[] = [];

        // Compress step
        if (postProcessing.compress) {
          setPipelineStep("compress");
          pipelineSteps.push("compress");

          const compressRes = await invoke<PdfCompressResult>("compress_pdf_cmd", {
            pdfPath: currentPdfPath,
            quality: postProcessing.compressQuality,
            outputDir,
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
            outputDir,
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
            const { rename, exists: fsExists, remove: fsRemove } = await import("@tauri-apps/plugin-fs");
            // If the desired name already exists, remove it first to avoid conflicts
            if (await fsExists(desiredPath)) {
              await fsRemove(desiredPath);
            }
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
        });

        if (pipelineErrors.length === 0) {
          toast.success(`Pipeline complete! (${pipelineSteps.join(" → ")})`);
          await openOutputDir();
        } else {
          toast.warning(`Pipeline finished with ${pipelineErrors.length} error(s).`);
          await openOutputDir();
        }
      } catch (err) {
        toast.error(`Pipeline failed: ${err}`);
        // Cleanup any temp files
        if (materializedPath) {
          await cleanupTemp(materializedPath);
        }
      } finally {
        setLoading(false);
        setPipelineStep(null);
      }
    },
    [materializeGrid, cleanupTemp]
  );

  // --- Standalone: Unlock PDF (no grid interaction) ---
  const unlockPdf = useCallback(
    async (
      pdfPath: string,
      password: string,
      outputDir: string,
      openOutputDir: () => Promise<void>
    ) => {
      if (!password.trim()) {
        toast.error("Please enter a password.");
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        const res = await invoke<PdfProtectResult>("unlock_pdf_cmd", {
          pdfPath,
          password,
          outputDir,
        });

        setResult({ type: "protect", data: res, mode: "unlock" });

        if (res.success) {
          toast.success("PDF unlocked successfully!");
          await openOutputDir();
        } else {
          toast.error(res.errors[0] || "Unlock failed.");
        }
      } catch (err) {
        toast.error(`${err}`);
      } finally {
        setLoading(false);
      }
    },
    []
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
    unlockPdf,
  };
}
