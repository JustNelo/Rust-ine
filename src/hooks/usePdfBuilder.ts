import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type {
  PageThumbnail,
  PdfBuilderItem,
  MergePdfOptions,
  MergePdfResult,
} from "../types";

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

export function usePdfBuilder() {
  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [result, setResult] = useState<MergePdfResult | null>(null);

  const addFiles = useCallback(async (paths: string[]) => {
    setResult(null);
    const imagePaths = paths.filter(isImageFile);
    const pdfPaths = paths.filter(isPdfFile);

    // Immediately add image pages with asset protocol thumbnails
    const imagePages: BuilderPage[] = imagePaths.map((path, index) => {
      const fileName = path.split(/[\\/]/).pop() || path;
      return {
        id: `img_${Date.now()}_${index}_${fileName}`,
        sourcePath: path,
        pageNumber: 0,
        sourceType: "image" as const,
        thumbnailSrc: convertFileSrc(path),
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

  const clearPages = useCallback(() => {
    setPages([]);
    setResult(null);
  }, []);

  const buildPdf = useCallback(
    async (options: MergePdfOptions) => {
      if (pages.length === 0) {
        toast.error("Please add at least one file.");
        return;
      }

      setLoading(true);
      setResult(null);

      const items: PdfBuilderItem[] = pages.map((page) => ({
        source_path: page.sourcePath,
        page_number: page.sourceType === "pdf" ? page.pageNumber : null,
        source_type: page.sourceType,
      }));

      try {
        const res = await invoke<MergePdfResult>("merge_to_pdf", {
          items,
          options,
        });

        setResult(res);

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
    [pages]
  );

  return {
    pages,
    loading,
    loadingThumbnails,
    result,
    addFiles,
    removePage,
    reorderPages,
    clearPages,
    buildPdf,
  };
}
