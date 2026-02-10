use ab_glyph::{FontArc, PxScale};
use image::{DynamicImage, ImageFormat, ImageReader, Rgba};
use imageproc::drawing::draw_text_mut;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Emitter;
use webp::Encoder;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProgressPayload {
    completed: usize,
    total: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessingResult {
    pub input_path: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
    pub input_size: u64,
    pub output_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchProgress {
    pub completed: usize,
    pub total: usize,
    pub results: Vec<ProcessingResult>,
}

impl BatchProgress {
    fn all_failed(input_paths: &[String], error: String) -> Self {
        Self {
            completed: 0,
            total: input_paths.len(),
            results: input_paths
                .iter()
                .map(|p| ProcessingResult {
                    input_path: p.clone(),
                    output_path: String::new(),
                    success: false,
                    error: Some(error.clone()),
                    input_size: 0,
                    output_size: 0,
                })
                .collect(),
        }
    }
}

fn file_size(path: &str) -> u64 {
    fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

fn load_image(path: &str) -> Result<DynamicImage, String> {
    ImageReader::open(path)
        .map_err(|e| format!("Cannot open file '{}': {}", path, e))?
        .decode()
        .map_err(|e| format!("Cannot decode image '{}': {}", path, e))
}

fn ensure_output_dir(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Cannot create output directory: {}", e))?;
    }
    Ok(())
}

pub fn compress_to_webp(
    input_paths: Vec<String>,
    quality: f32,
    output_dir: String,
    app_handle: tauri::AppHandle,
) -> BatchProgress {
    let total = input_paths.len();
    let out_dir = PathBuf::from(&output_dir);

    if let Err(e) = ensure_output_dir(&out_dir) {
        return BatchProgress::all_failed(&input_paths, e);
    }

    let processed = AtomicUsize::new(0);

    let results: Vec<ProcessingResult> = input_paths
        .par_iter()
        .map(|input_path| {
            let result = (|| -> Result<String, String> {
                let img = load_image(input_path)?;
                let rgba = img.to_rgba8();
                let (w, h) = rgba.dimensions();

                let encoder = Encoder::from_rgba(&rgba, w, h);
                let webp_data = encoder.encode(quality);

                let stem = Path::new(input_path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");

                let output_path = out_dir.join(format!("{}.webp", stem));
                fs::write(&output_path, &*webp_data)
                    .map_err(|e| format!("Cannot write WebP file: {}", e))?;

                Ok(output_path.to_string_lossy().to_string())
            })();

            let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = app_handle.emit("processing-progress", ProgressPayload {
                completed: done,
                total,
            });

            let input_size = file_size(input_path);
            match result {
                Ok(output_path) => {
                    let output_size = file_size(&output_path);
                    ProcessingResult {
                        input_path: input_path.clone(),
                        output_path,
                        success: true,
                        error: None,
                        input_size,
                        output_size,
                    }
                }
                Err(e) => ProcessingResult {
                    input_path: input_path.clone(),
                    output_path: String::new(),
                    success: false,
                    error: Some(e),
                    input_size,
                    output_size: 0,
                },
            }
        })
        .collect();

    let completed = results.iter().filter(|r| r.success).count();
    BatchProgress {
        completed,
        total,
        results,
    }
}

pub fn convert_images(
    input_paths: Vec<String>,
    output_format: String,
    output_dir: String,
    app_handle: tauri::AppHandle,
) -> BatchProgress {
    let total = input_paths.len();
    let out_dir = PathBuf::from(&output_dir);

    if let Err(e) = ensure_output_dir(&out_dir) {
        return BatchProgress::all_failed(&input_paths, e);
    }

    let target_format = output_format.to_lowercase();
    let processed = AtomicUsize::new(0);

    let results: Vec<ProcessingResult> = input_paths
        .par_iter()
        .map(|input_path| {
            let result = (|| -> Result<String, String> {
                let img = load_image(input_path)?;

                let stem = Path::new(input_path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");

                match target_format.as_str() {
                    "webp" => {
                        let rgba = img.to_rgba8();
                        let (w, h) = rgba.dimensions();
                        let encoder = Encoder::from_rgba(&rgba, w, h);
                        let webp_data = encoder.encode(100.0);
                        let output_path = out_dir.join(format!("{}.webp", stem));
                        fs::write(&output_path, &*webp_data)
                            .map_err(|e| format!("Cannot write WebP: {}", e))?;
                        Ok(output_path.to_string_lossy().to_string())
                    }
                    "png" => {
                        let output_path = out_dir.join(format!("{}.png", stem));
                        img.save_with_format(&output_path, ImageFormat::Png)
                            .map_err(|e| format!("Cannot save PNG: {}", e))?;
                        Ok(output_path.to_string_lossy().to_string())
                    }
                    "jpg" | "jpeg" => {
                        let output_path = out_dir.join(format!("{}.jpg", stem));
                        img.save_with_format(&output_path, ImageFormat::Jpeg)
                            .map_err(|e| format!("Cannot save JPEG: {}", e))?;
                        Ok(output_path.to_string_lossy().to_string())
                    }
                    "bmp" => {
                        let output_path = out_dir.join(format!("{}.bmp", stem));
                        img.save_with_format(&output_path, ImageFormat::Bmp)
                            .map_err(|e| format!("Cannot save BMP: {}", e))?;
                        Ok(output_path.to_string_lossy().to_string())
                    }
                    "ico" => {
                        let resized = img.resize(256, 256, image::imageops::FilterType::Lanczos3);
                        let output_path = out_dir.join(format!("{}.ico", stem));
                        resized.save_with_format(&output_path, ImageFormat::Ico)
                            .map_err(|e| format!("Cannot save ICO: {}", e))?;
                        Ok(output_path.to_string_lossy().to_string())
                    }
                    "tiff" | "tif" => {
                        let output_path = out_dir.join(format!("{}.tiff", stem));
                        img.save_with_format(&output_path, ImageFormat::Tiff)
                            .map_err(|e| format!("Cannot save TIFF: {}", e))?;
                        Ok(output_path.to_string_lossy().to_string())
                    }
                    _ => Err(format!("Unsupported output format: {}", target_format)),
                }
            })();

            let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = app_handle.emit("processing-progress", ProgressPayload {
                completed: done,
                total,
            });

            let input_size = file_size(input_path);
            match result {
                Ok(output_path) => {
                    let output_size = file_size(&output_path);
                    ProcessingResult {
                        input_path: input_path.clone(),
                        output_path,
                        success: true,
                        error: None,
                        input_size,
                        output_size,
                    }
                }
                Err(e) => ProcessingResult {
                    input_path: input_path.clone(),
                    output_path: String::new(),
                    success: false,
                    error: Some(e),
                    input_size,
                    output_size: 0,
                },
            }
        })
        .collect();

    let completed = results.iter().filter(|r| r.success).count();
    BatchProgress {
        completed,
        total,
        results,
    }
}

// --- Shared helpers for new features ---

fn get_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "png".to_string())
}

fn save_in_original_format(img: &DynamicImage, input_path: &str, output_path: &Path) -> Result<(), String> {
    let ext = get_extension(input_path);
    match ext.as_str() {
        "webp" => {
            let rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            let encoder = Encoder::from_rgba(&rgba, w, h);
            let webp_data = encoder.encode(90.0);
            fs::write(output_path, &*webp_data)
                .map_err(|e| format!("Cannot write WebP: {}", e))
        }
        "jpg" | "jpeg" => img
            .save_with_format(output_path, ImageFormat::Jpeg)
            .map_err(|e| format!("Cannot save JPEG: {}", e)),
        "bmp" => img
            .save_with_format(output_path, ImageFormat::Bmp)
            .map_err(|e| format!("Cannot save BMP: {}", e)),
        "tiff" | "tif" => img
            .save_with_format(output_path, ImageFormat::Tiff)
            .map_err(|e| format!("Cannot save TIFF: {}", e)),
        "ico" => img
            .save_with_format(output_path, ImageFormat::Ico)
            .map_err(|e| format!("Cannot save ICO: {}", e)),
        _ => img
            .save_with_format(output_path, ImageFormat::Png)
            .map_err(|e| format!("Cannot save PNG: {}", e)),
    }
}

fn build_result(input_path: &str, result: Result<String, String>) -> ProcessingResult {
    let input_size = file_size(input_path);
    match result {
        Ok(output_path) => {
            let output_size = file_size(&output_path);
            ProcessingResult {
                input_path: input_path.to_string(),
                output_path,
                success: true,
                error: None,
                input_size,
                output_size,
            }
        }
        Err(e) => ProcessingResult {
            input_path: input_path.to_string(),
            output_path: String::new(),
            success: false,
            error: Some(e),
            input_size,
            output_size: 0,
        },
    }
}

fn emit_progress(app_handle: &tauri::AppHandle, processed: &AtomicUsize, total: usize) {
    let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
    let _ = app_handle.emit(
        "processing-progress",
        ProgressPayload { completed: done, total },
    );
}

// --- Resize ---

pub fn resize_images(
    input_paths: Vec<String>,
    mode: String,
    width: u32,
    height: u32,
    percentage: u32,
    output_dir: String,
    app_handle: tauri::AppHandle,
) -> BatchProgress {
    let total = input_paths.len();
    let out_dir = PathBuf::from(&output_dir);

    if let Err(e) = ensure_output_dir(&out_dir) {
        return BatchProgress::all_failed(&input_paths, e);
    }

    let processed = AtomicUsize::new(0);

    let results: Vec<ProcessingResult> = input_paths
        .par_iter()
        .map(|input_path| {
            let result = (|| -> Result<String, String> {
                let img = load_image(input_path)?;
                let (orig_w, orig_h) = (img.width(), img.height());

                let (new_w, new_h) = match mode.as_str() {
                    "exact" => (width, height),
                    "width" => {
                        let ratio = width as f64 / orig_w as f64;
                        (width, (orig_h as f64 * ratio).round() as u32)
                    }
                    "height" => {
                        let ratio = height as f64 / orig_h as f64;
                        ((orig_w as f64 * ratio).round() as u32, height)
                    }
                    "percentage" => {
                        let scale = percentage as f64 / 100.0;
                        (
                            (orig_w as f64 * scale).round() as u32,
                            (orig_h as f64 * scale).round() as u32,
                        )
                    }
                    _ => return Err(format!("Unknown resize mode: {}", mode)),
                };

                if new_w == 0 || new_h == 0 {
                    return Err("Target dimensions cannot be zero".to_string());
                }

                let resized = img.resize_exact(new_w, new_h, image::imageops::FilterType::Lanczos3);

                let ext = get_extension(input_path);
                let stem = Path::new(input_path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");
                let output_path = out_dir.join(format!("{}.{}", stem, ext));

                save_in_original_format(&resized, input_path, &output_path)?;
                Ok(output_path.to_string_lossy().to_string())
            })();

            emit_progress(&app_handle, &processed, total);
            build_result(input_path, result)
        })
        .collect();

    let completed = results.iter().filter(|r| r.success).count();
    BatchProgress { completed, total, results }
}

// --- EXIF Strip ---

pub fn strip_metadata(
    input_paths: Vec<String>,
    output_dir: String,
    app_handle: tauri::AppHandle,
) -> BatchProgress {
    let total = input_paths.len();
    let out_dir = PathBuf::from(&output_dir);

    if let Err(e) = ensure_output_dir(&out_dir) {
        return BatchProgress::all_failed(&input_paths, e);
    }

    let processed = AtomicUsize::new(0);

    let results: Vec<ProcessingResult> = input_paths
        .par_iter()
        .map(|input_path| {
            let result = (|| -> Result<String, String> {
                let img = load_image(input_path)?;

                let ext = get_extension(input_path);
                let stem = Path::new(input_path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");
                let output_path = out_dir.join(format!("{}.{}", stem, ext));

                save_in_original_format(&img, input_path, &output_path)?;
                Ok(output_path.to_string_lossy().to_string())
            })();

            emit_progress(&app_handle, &processed, total);
            build_result(input_path, result)
        })
        .collect();

    let completed = results.iter().filter(|r| r.success).count();
    BatchProgress { completed, total, results }
}

// --- Watermark ---

fn find_system_font() -> Result<Vec<u8>, String> {
    let candidates: Vec<&str> = if cfg!(target_os = "windows") {
        vec![
            "C:\\Windows\\Fonts\\arial.ttf",
            "C:\\Windows\\Fonts\\segoeui.ttf",
            "C:\\Windows\\Fonts\\tahoma.ttf",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/SFNSText.ttf",
        ]
    } else {
        vec![
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    };

    for path in &candidates {
        if let Ok(data) = fs::read(path) {
            return Ok(data);
        }
    }

    Err("No system font found. Install Arial, DejaVu Sans, or Liberation Sans.".to_string())
}

pub fn add_watermark(
    input_paths: Vec<String>,
    text: String,
    position: String,
    opacity: f32,
    font_size: f32,
    output_dir: String,
    app_handle: tauri::AppHandle,
) -> BatchProgress {
    let total = input_paths.len();
    let out_dir = PathBuf::from(&output_dir);

    if let Err(e) = ensure_output_dir(&out_dir) {
        return BatchProgress::all_failed(&input_paths, e);
    }

    let font_data = match find_system_font() {
        Ok(d) => d,
        Err(e) => return BatchProgress::all_failed(&input_paths, e),
    };
    let font = match FontArc::try_from_vec(font_data) {
        Ok(f) => f,
        Err(_) => return BatchProgress::all_failed(&input_paths, "Failed to load font".to_string()),
    };

    let processed = AtomicUsize::new(0);
    let opacity_byte = (opacity.clamp(0.0, 1.0) * 255.0) as u8;
    let color = Rgba([255u8, 255, 255, opacity_byte]);
    let scale = PxScale::from(font_size);

    let results: Vec<ProcessingResult> = input_paths
        .par_iter()
        .map(|input_path| {
            let result = (|| -> Result<String, String> {
                let img = load_image(input_path)?;
                let (img_w, img_h) = (img.width(), img.height());
                let mut base = img.to_rgba8();

                let text_width = (font_size * text.len() as f32 * 0.55) as i32;
                let text_height = font_size as i32;
                let margin = 20i32;

                match position.as_str() {
                    "center" => {
                        let x = (img_w as i32 - text_width) / 2;
                        let y = (img_h as i32 - text_height) / 2;
                        draw_text_mut(&mut base, color, x, y, scale, &font, &text);
                    }
                    "top-left" => {
                        draw_text_mut(&mut base, color, margin, margin, scale, &font, &text);
                    }
                    "top-right" => {
                        let x = img_w as i32 - text_width - margin;
                        draw_text_mut(&mut base, color, x, margin, scale, &font, &text);
                    }
                    "bottom-left" => {
                        let y = img_h as i32 - text_height - margin;
                        draw_text_mut(&mut base, color, margin, y, scale, &font, &text);
                    }
                    "bottom-right" => {
                        let x = img_w as i32 - text_width - margin;
                        let y = img_h as i32 - text_height - margin;
                        draw_text_mut(&mut base, color, x, y, scale, &font, &text);
                    }
                    "tiled" => {
                        let step_x = text_width + 80;
                        let step_y = text_height + 80;
                        let mut y = margin;
                        while y < img_h as i32 {
                            let mut x = margin;
                            while x < img_w as i32 {
                                draw_text_mut(&mut base, color, x, y, scale, &font, &text);
                                x += step_x;
                            }
                            y += step_y;
                        }
                    }
                    _ => {
                        let x = (img_w as i32 - text_width) / 2;
                        let y = (img_h as i32 - text_height) / 2;
                        draw_text_mut(&mut base, color, x, y, scale, &font, &text);
                    }
                }

                let result_img = DynamicImage::ImageRgba8(base);
                let ext = get_extension(input_path);
                let stem = Path::new(input_path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");
                let output_path = out_dir.join(format!("{}.{}", stem, ext));

                save_in_original_format(&result_img, input_path, &output_path)?;
                Ok(output_path.to_string_lossy().to_string())
            })();

            emit_progress(&app_handle, &processed, total);
            build_result(input_path, result)
        })
        .collect();

    let completed = results.iter().filter(|r| r.success).count();
    BatchProgress { completed, total, results }
}
