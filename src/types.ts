export interface ProcessingResult {
  input_path: string;
  output_path: string;
  success: boolean;
  error: string | null;
  input_size: number;
  output_size: number;
  input_width: number;
  input_height: number;
  output_width: number;
  output_height: number;
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

export interface MetadataEntry {
  tag: string;
  value: string;
}

export interface ImageMetadata {
  path: string;
  width: number;
  height: number;
  format: string;
  file_size: number;
  exif: MetadataEntry[];
}

export type TabId = "compress" | "convert" | "resize" | "watermark" | "strip" | "pdf" | "images-to-pdf";
