export interface ProcessingResult {
  input_path: string;
  output_path: string;
  success: boolean;
  error: string | null;
  input_size: number;
  output_size: number;
}

export interface BatchProgress {
  completed: number;
  total: number;
  results: ProcessingResult[];
}

export interface PdfExtractionResult {
  pdf_path: string;
  output_dir: string;
  extracted_count: number;
  errors: string[];
}

export type OutputFormat = "png" | "jpg" | "webp" | "bmp" | "ico" | "tiff";

export type ResizeMode = "exact" | "width" | "height" | "percentage";

export type WatermarkPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "tiled";

export interface ImagesToPdfResult {
  output_path: string;
  page_count: number;
  errors: string[];
}

export type TabId = "compress" | "convert" | "resize" | "watermark" | "strip" | "pdf" | "images-to-pdf";
