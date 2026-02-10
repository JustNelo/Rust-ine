export interface ProcessingResult {
  input_path: string;
  output_path: string;
  success: boolean;
  error: string | null;
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

export type TabId = "compress" | "convert" | "pdf";
