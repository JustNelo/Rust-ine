import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { safeAssetUrl, formatSize } from "../lib/utils";
import type {
  PageThumbnail,
  PdfBuilderItem,
  MergePdfOptions,
  MergePdfResult,
  PdfExtractionResult,
} from "../types";

// --- Types ---

export type PdfToolAction =
  | "build"
  | "split"
  | "export-images"
  | "extract-images"
  | "compress"
  | "protect";

export type ProtectMode = "protect" | "unlock";
export type ExportFormat = "png" | "jpg";
export type ExportDpi = 72 | 150 | 300;

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp",
]);

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
  | { type: "protect"; data: PdfProtectResult; mode: ProtectMode };

// --- Hook ---

export function usePdfWorkbench() {
  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [result, setResult] = useState<WorkbenchResult | null>(null);
  const pagesRef = useRef(pages);
  const sourcePathsRef = useRef(sourcePaths);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { sourcePathsRef.current = sourcePaths; }, [sourcePaths]);

  // --- Page management (shared across all actions) ---

  const addFiles = useCallback(async (paths: string[]) => {
    setResult(null);
    const imagePaths = paths.filter(isImageFile);
    const pdfPaths = paths.filter(isPdfFile);

    // Track raw source paths for actions that operate on original files
    setSourcePaths((prev) => {
      const existing = new Set(prev);
      const newPaths = paths.filter((p) => !existing.has(p));
      return [...prev, ...newPaths];
    });

    // Immediately add image pages with asset protocol thumbnails
    const imagePages: BuilderPage[] = imagePaths.map((path, index) => {
      const fileName = path.split(/[\\/]/).pop() || path;
      return {
        id: `img_${Date.now()}_${index}_${fileName}`,
        sourcePath: path,
        pageNumber: 0,
        sourceType: "image" as const,
        thumbnailSrc: safeAssetUrl(path),
        fileName,
      };
    });

    if (imagePages.length > 0) {
      setPages((prev) => [...prev, ...imagePages]);
    }

    // Generate thumbnails for PDF pages via backend
    if (pdfPaths.length > 0) {
      setLoadingThumbnails(true);
      try {
        const thumbnails = await invoke<PageThumbnail[]>(
          "generate_pdf_thumbnails",
          { filePaths: pdfPaths }
        );

        const pdfPages: BuilderPage[] = thumbnails.map((thumb) => {
          const fileName = thumb.source_path.split(/[\\/]/).pop() || thumb.source_path;
          return {
            id: thumb.id + "_" + Date.now(),
            sourcePath: thumb.source_path,
            pageNumber: thumb.page_number,
            sourceType: "pdf" as const,
            thumbnailSrc: thumb.thumbnail_b64
              ? `data:image/jpeg;base64,${thumb.thumbnail_b64}`
              : "",
            fileName,
          };
        });

        setPages((prev) => [...prev, ...pdfPages]);
      } catch (err) {
        toast.error(`Failed to load PDF pages: ${err}`);
      } finally {
        setLoadingThumbnails(false);
      }
    }
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
  }, []);

  const reorderPages = useCallback((reordered: BuilderPage[]) => {
    setPages(reordered);
  }, []);

  const clearAll = useCallback(() => {
    setPages([]);
    setSourcePaths([]);
    setResult(null);
  }, []);

  // --- Unique PDF source paths from loaded pages ---
  const getUniquePdfPaths = useCallback((): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const page of pagesRef.current) {
      if (page.sourceType === "pdf" && !seen.has(page.sourcePath)) {
        seen.add(page.sourcePath);
        result.push(page.sourcePath);
      }
    }
    return result;
  }, []);

  // --- Action: Build PDF ---
  const buildPdf = useCallback(
    async (options: MergePdfOptions) => {
      const currentPages = pagesRef.current;
      if (currentPages.length === 0) {
        toast.error("Please add at least one file.");
        return;
      }

      setLoading(true);
      setResult(null);

      const items: PdfBuilderItem[] = currentPages.map((page) => ({
        source_path: page.sourcePath,
        page_number: page.sourceType === "pdf" ? page.pageNumber : null,
        source_type: page.sourceType,
      }));

      try {
        const res = await invoke<MergePdfResult>("merge_to_pdf", {
          items,
          options,
        });

        setResult({ type: "build", data: res });

        if (res.page_count > 0 && res.errors.length === 0) {
          toast.success(`PDF created with ${res.page_count} page(s)!`);
        } else if (res.page_count > 0) {
          toast.warning(
            `PDF created with ${res.page_count} page(s), ${res.errors.length} error(s).`
          );
        } else {
          toast.error("Failed to create PDF.");
        }
      } catch (err) {
        toast.error(`PDF build failed: ${err}`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // --- Action: Split PDF ---
  const splitPdf = useCallback(
    async (ranges: string, outputDir: string, openOutputDir: () => Promise<void>) => {
      const pdfPaths = getUniquePdfPaths();
      if (pdfPaths.length === 0) {
        toast.error("Please add a PDF file.");
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        const res = await invoke<PdfSplitResult>("split_pdf", {
          pdfPath: pdfPaths[0],
          ranges,
          outputDir,
        });

        setResult({ type: "split", data: res });

        if (res.output_files.length > 0 && res.errors.length === 0) {
          toast.success(`PDF split into ${res.output_files.length} file(s)!`);
          await openOutputDir();
        } else if (res.output_files.length > 0) {
          toast.warning(`${res.output_files.length} file(s) created, ${res.errors.length} error(s).`);
          await openOutputDir();
        } else {
          toast.error("Split failed.");
        }
      } catch (err) {
        toast.error(`Split failed: ${err}`);
      } finally {
        setLoading(false);
      }
    },
    [getUniquePdfPaths]
  );

  // --- Action: Export pages as images ---
  const exportToImages = useCallback(
    async (format: ExportFormat, dpi: ExportDpi, outputDir: string, openOutputDir: () => Promise<void>) => {
      const pdfPaths = getUniquePdfPaths();
      if (pdfPaths.length === 0) {
        toast.error("Please add a PDF file.");
        return;
      }

      setLoading(true);
      setResult(null);

      const aggregated = { exported: 0, errors: [] as string[] };

      for (const file of pdfPaths) {
        try {
          const res = await invoke<PdfToImagesResult>("pdf_to_images", {
            pdfPath: file,
            outputDir,
            format,
            dpi,
          });
          aggregated.exported += res.exported_count;
          aggregated.errors.push(...res.errors);
        } catch (err) {
          const filename = file.split(/[\\/]/).pop() || file;
          aggregated.errors.push(`${filename}: ${err}`);
        }
      }

      setResult({ type: "export-images", data: aggregated });

      if (aggregated.exported > 0 && aggregated.errors.length === 0) {
        toast.success(`${aggregated.exported} page(s) exported as images!`);
        await openOutputDir();
      } else if (aggregated.exported > 0) {
        toast.warning(`${aggregated.exported} exported, some errors.`);
        await openOutputDir();
      } else {
        toast.error("Export failed.");
      }

      setLoading(false);
    },
    [getUniquePdfPaths]
  );

  // --- Action: Extract embedded images ---
  const extractImages = useCallback(
    async (outputDir: string, openOutputDir: () => Promise<void>) => {
      const pdfPaths = getUniquePdfPaths();
      if (pdfPaths.length === 0) {
        toast.error("Please add a PDF file.");
        return;
      }

      setLoading(true);
      setResult(null);

      const aggregated = { total_extracted: 0, errors: [] as string[] };
      const total = pdfPaths.length;

      for (let i = 0; i < total; i++) {
        try {
          const res = await invoke<PdfExtractionResult>("extract_pdf_images", {
            pdfPath: pdfPaths[i],
            outputDir,
          });
          aggregated.total_extracted += res.extracted_count;
          aggregated.errors.push(...res.errors);
        } catch (err) {
          const filename = pdfPaths[i].split(/[\\/]/).pop() || pdfPaths[i];
          aggregated.errors.push(`${filename}: ${err}`);
        }
        await emit("processing-progress", { completed: i + 1, total });
      }

      setResult({ type: "extract-images", data: aggregated });

      if (aggregated.total_extracted > 0 && aggregated.errors.length === 0) {
        toast.success(`${aggregated.total_extracted} image(s) extracted!`);
        await openOutputDir();
      } else if (aggregated.total_extracted > 0) {
        toast.warning(`${aggregated.total_extracted} extracted, some errors.`);
        await openOutputDir();
      } else if (aggregated.errors.length > 0) {
        toast.error("Extraction failed.");
      } else {
        toast.info("No images found in this PDF.");
      }

      setLoading(false);
      await emit("processing-progress", { completed: total, total });
    },
    [getUniquePdfPaths]
  );

  // --- Action: Compress PDF ---
  const compressPdf = useCallback(
    async (quality: number, outputDir: string, openOutputDir: () => Promise<void>) => {
      const pdfPaths = getUniquePdfPaths();
      if (pdfPaths.length === 0) {
        toast.error("Please add a PDF file.");
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        const res = await invoke<PdfCompressResult>("compress_pdf_cmd", {
          pdfPath: pdfPaths[0],
          quality,
          outputDir,
        });

        setResult({ type: "compress", data: res });

        if (res.errors.length === 0 && res.output_path) {
          toast.success(`PDF compressed! (${formatSize(res.compressed_size)})`);
          await openOutputDir();
        } else {
          toast.error("Compression failed.");
        }
      } catch (err) {
        toast.error(`Compression failed: ${err}`);
      } finally {
        setLoading(false);
      }
    },
    [getUniquePdfPaths]
  );

  // --- Action: Protect / Unlock PDF ---
  const protectPdf = useCallback(
    async (
      mode: ProtectMode,
      password: string,
      outputDir: string,
      openOutputDir: () => Promise<void>
    ) => {
      const pdfPaths = getUniquePdfPaths();
      if (pdfPaths.length === 0) {
        toast.error("Please add a PDF file.");
        return;
      }
      if (!password.trim()) {
        toast.error("Please enter a password.");
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        const command = mode === "protect" ? "protect_pdf_cmd" : "unlock_pdf_cmd";
        const res = await invoke<PdfProtectResult>(command, {
          pdfPath: pdfPaths[0],
          password,
          outputDir,
        });

        setResult({ type: "protect", data: res, mode });

        if (res.success) {
          toast.success(
            mode === "protect"
              ? "PDF protected with password!"
              : "PDF unlocked successfully!"
          );
          await openOutputDir();
        } else {
          toast.error(res.errors[0] || "Operation failed.");
        }
      } catch (err) {
        toast.error(`${err}`);
      } finally {
        setLoading(false);
      }
    },
    [getUniquePdfPaths]
  );

  return {
    // Page state
    pages,
    sourcePaths,
    loading,
    loadingThumbnails,
    result,
    // Page management
    addFiles,
    removePage,
    reorderPages,
    clearAll,
    // Actions
    buildPdf,
    splitPdf,
    exportToImages,
    extractImages,
    compressPdf,
    protectPdf,
  };
}
