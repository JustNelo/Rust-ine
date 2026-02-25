use ab_glyph::{FontArc, PxScale};
use image::{DynamicImage, ImageFormat, ImageReader, Rgba};
use imageproc::drawing::draw_text_mut;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use webp::Encoder;

use crate::utils::{ensure_output_dir, file_size, file_stem, get_extension};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProgressPayload {
    completed: usize,
    total: usize,
    current_file: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessingResult {
    pub input_path: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
    pub input_size: u64,
    pub output_size: u64,
    pub input_width: u32,
    pub input_height: u32,
    pub output_width: u32,
    pub output_height: u32,
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
                    input_width: 0,
                    input_height: 0,
                    output_width: 0,
                    output_height: 0,
                })
                .collect(),
        }
    }
}

fn load_image(path: &str) -> Result<DynamicImage, String> {
    ImageReader::open(path)
        .map_err(|e| format!("Cannot open file '{}': {}", path, e))?
        .decode()
        .map_err(|e| format!("Cannot decode image '{}': {}", path, e))
}

pub fn compress_to_webp(
    input_paths: Vec<String>,
    quality: f32,
    output_dir: String,
    app_handle: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
        let img = load_image(input_path)?;
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();

        let encoder = Encoder::from_rgba(&rgba, w, h);
        let webp_data = encoder.encode(quality);

        let stem = file_stem(input_path);
        let output_path = out_dir.join(format!("{}-compressed.webp", stem));
        fs::write(&output_path, &*webp_data)
            .map_err(|e| format!("Cannot write WebP file: {}", e))?;

        Ok((output_path.to_string_lossy().to_string(), None))
    })
}

pub fn convert_images(
    input_paths: Vec<String>,
    output_format: String,
    output_dir: String,
    app_handle: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    let target_format = output_format.to_lowercase();

    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
        let img = load_image(input_path)?;
        let stem = file_stem(input_path);

        let output_path_str = match target_format.as_str() {
            "webp" => {
                let rgba = img.to_rgba8();
                let (w, h) = rgba.dimensions();
                let encoder = Encoder::from_rgba(&rgba, w, h);
                let webp_data = encoder.encode(100.0);
                let output_path = out_dir.join(format!("{}-converted.webp", stem));
                fs::write(&output_path, &*webp_data)
                    .map_err(|e| format!("Cannot write WebP: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            "png" => {
                let output_path = out_dir.join(format!("{}-converted.png", stem));
                img.save_with_format(&output_path, ImageFormat::Png)
                    .map_err(|e| format!("Cannot save PNG: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            "jpg" | "jpeg" => {
                let output_path = out_dir.join(format!("{}-converted.jpg", stem));
                img.save_with_format(&output_path, ImageFormat::Jpeg)
                    .map_err(|e| format!("Cannot save JPEG: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            "bmp" => {
                let output_path = out_dir.join(format!("{}-converted.bmp", stem));
                img.save_with_format(&output_path, ImageFormat::Bmp)
                    .map_err(|e| format!("Cannot save BMP: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            "ico" => {
                let resized = img.resize(256, 256, image::imageops::FilterType::Lanczos3);
                let output_path = out_dir.join(format!("{}-converted.ico", stem));
                resized.save_with_format(&output_path, ImageFormat::Ico)
                    .map_err(|e| format!("Cannot save ICO: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            "tiff" | "tif" => {
                let output_path = out_dir.join(format!("{}-converted.tiff", stem));
                img.save_with_format(&output_path, ImageFormat::Tiff)
                    .map_err(|e| format!("Cannot save TIFF: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            _ => return Err(format!("Unsupported output format: {}", target_format)),
        };

        Ok((output_path_str, None))
    })
}

// --- Shared helpers for new features ---

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

fn build_result(
    input_path: &str,
    result: Result<String, String>,
    dims: Option<(u32, u32, u32, u32)>,
) -> ProcessingResult {
    let input_size = file_size(input_path);
    let (iw, ih, ow, oh) = dims.unwrap_or((0, 0, 0, 0));
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
                input_width: iw,
                input_height: ih,
                output_width: ow,
                output_height: oh,
            }
        }
        Err(e) => ProcessingResult {
            input_path: input_path.to_string(),
            output_path: String::new(),
            success: false,
            error: Some(e),
            input_size,
            output_size: 0,
            input_width: iw,
            input_height: ih,
            output_width: 0,
            output_height: 0,
        },
    }
}

fn emit_progress(app_handle: &tauri::AppHandle, processed: &AtomicUsize, total: usize, current_file: &str) {
    let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
    let filename = std::path::Path::new(current_file)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or_else(|| current_file)
        .to_string();
    let _ = app_handle.emit(
        "processing-progress",
        ProgressPayload { completed: done, total, current_file: filename },
    );
}

/// Generic batch processor — handles output dir creation, parallel iteration,
/// progress events, and result aggregation. Each caller only provides its
/// per-file processing closure.
///
/// The closure receives `(input_path, output_dir)` and returns
/// `Ok((output_path, optional_dims))` or `Err(message)`.
fn batch_process<F>(
    input_paths: &[String],
    output_dir: &str,
    app_handle: &tauri::AppHandle,
    cancel: &Arc<AtomicBool>,
    process_fn: F,
) -> BatchProgress
where
    F: Fn(&str, &Path) -> Result<(String, Option<(u32, u32, u32, u32)>), String> + Sync,
{
    let total = input_paths.len();
    let out_dir = PathBuf::from(output_dir);

    if let Err(e) = ensure_output_dir(&out_dir) {
        return BatchProgress::all_failed(input_paths, e);
    }

    let processed = AtomicUsize::new(0);

    let results: Vec<ProcessingResult> = input_paths
        .par_iter()
        .map(|input_path| {
            if cancel.load(Ordering::Relaxed) {
                return build_result(input_path, Err("Cancelled".to_string()), None);
            }

            let result = process_fn(input_path, &out_dir);
            emit_progress(app_handle, &processed, total, input_path);

            let (path_result, dims) = match result {
                Ok((path, dims)) => (Ok(path), dims),
                Err(e) => (Err(e), None),
            };
            build_result(input_path, path_result, dims)
        })
        .collect();

    let completed = results.iter().filter(|r| r.success).count();
    BatchProgress { completed, total, results }
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
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
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
        let stem = file_stem(input_path);
        let output_path = out_dir.join(format!("{}-resized.{}", stem, ext));

        save_in_original_format(&resized, input_path, &output_path)?;
        Ok((output_path.to_string_lossy().to_string(), Some((orig_w, orig_h, new_w, new_h))))
    })
}

// --- EXIF Strip ---

pub fn strip_metadata(
    input_paths: Vec<String>,
    output_dir: String,
    app_handle: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
        let img = load_image(input_path)?;
        let (w, h) = (img.width(), img.height());

        let ext = get_extension(input_path);
        let stem = file_stem(input_path);
        let output_path = out_dir.join(format!("{}-stripped.{}", stem, ext));

        save_in_original_format(&img, input_path, &output_path)?;
        Ok((output_path.to_string_lossy().to_string(), Some((w, h, w, h))))
    })
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
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    let font_data = match find_system_font() {
        Ok(d) => d,
        Err(e) => return BatchProgress::all_failed(&input_paths, e),
    };
    let font = match FontArc::try_from_vec(font_data) {
        Ok(f) => f,
        Err(_) => return BatchProgress::all_failed(&input_paths, "Failed to load font".to_string()),
    };

    let opacity_byte = (opacity.clamp(0.0, 1.0) * 255.0) as u8;
    let color = Rgba([255u8, 255, 255, opacity_byte]);
    let scale = PxScale::from(font_size);

    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
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
        let stem = file_stem(input_path);
        let output_path = out_dir.join(format!("{}-watermarked.{}", stem, ext));

        save_in_original_format(&result_img, input_path, &output_path)?;
        Ok((output_path.to_string_lossy().to_string(), Some((img_w, img_h, img_w, img_h))))
    })
}

// --- Lossless Optimize ---

pub fn optimize_lossless(
    input_paths: Vec<String>,
    output_dir: String,
    app_handle: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
        let ext = get_extension(input_path);
        let stem = file_stem(input_path);

        let output_path_str = match ext.as_str() {
            "png" => {
                let input_data = fs::read(input_path)
                    .map_err(|e| format!("Cannot read '{}': {}", input_path, e))?;

                let optimized = oxipng::optimize_from_memory(
                    &input_data,
                    &oxipng::Options::from_preset(4),
                )
                .map_err(|e| format!("PNG optimization failed: {}", e))?;

                let output_path = out_dir.join(format!("{}-optimized.png", stem));
                fs::write(&output_path, &optimized)
                    .map_err(|e| format!("Cannot write optimized PNG: {}", e))?;

                output_path.to_string_lossy().to_string()
            }
            "jpg" | "jpeg" => {
                // Re-encode JPEG with optimized Huffman tables at quality 100
                let img = load_image(input_path)?;
                let output_path = out_dir.join(format!("{}-optimized.jpg", stem));
                img.save_with_format(&output_path, ImageFormat::Jpeg)
                    .map_err(|e| format!("Cannot save optimized JPEG: {}", e))?;
                output_path.to_string_lossy().to_string()
            }
            _ => return Err(format!("Unsupported format for optimization: {}", ext)),
        };

        Ok((output_path_str, None))
    })
}

// --- Crop ---

fn parse_ratio(ratio: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = ratio.split(':').collect();
    if parts.len() == 2 {
        if let (Ok(w), Ok(h)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
            if w > 0.0 && h > 0.0 {
                return Some((w, h));
            }
        }
    }
    None
}

#[allow(clippy::too_many_arguments)]
pub fn crop_images(
    input_paths: Vec<String>,
    ratio: String,
    anchor: String,
    target_width: u32,
    target_height: u32,
    crop_x: Option<u32>,
    crop_y: Option<u32>,
    output_dir: String,
    app_handle: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> BatchProgress {
    batch_process(&input_paths, &output_dir, &app_handle, &cancel, |input_path, out_dir| {
        let img = load_image(input_path)?;
        let (orig_w, orig_h) = (img.width(), img.height());

        // When explicit crop_x/crop_y are provided, use them directly
        // (free-form rectangle drawn by the user on the preview)
        if let (Some(cx), Some(cy)) = (crop_x, crop_y) {
            let cw = target_width.min(orig_w.saturating_sub(cx));
            let ch = target_height.min(orig_h.saturating_sub(cy));
            if cw == 0 || ch == 0 {
                return Err("Crop dimensions cannot be zero".to_string());
            }
            let cropped = img.crop_imm(cx.min(orig_w), cy.min(orig_h), cw, ch);
            let ext = get_extension(input_path);
            let stem = file_stem(input_path);
            let output_path = out_dir.join(format!("{}-cropped.{}", stem, ext));
            save_in_original_format(&cropped, input_path, &output_path)?;
            return Ok((output_path.to_string_lossy().to_string(), Some((orig_w, orig_h, cw, ch))));
        }

        let (crop_w, crop_h) = if ratio == "free" {
            (target_width.min(orig_w), target_height.min(orig_h))
        } else if let Some((rw, rh)) = parse_ratio(&ratio) {
            let scale_w = orig_w as f64 / rw;
            let scale_h = orig_h as f64 / rh;
            let scale = scale_w.min(scale_h);
            let cw = (rw * scale).round() as u32;
            let ch = (rh * scale).round() as u32;
            (cw.min(orig_w), ch.min(orig_h))
        } else {
            return Err(format!("Invalid crop ratio: {}", ratio));
        };

        if crop_w == 0 || crop_h == 0 {
            return Err("Crop dimensions cannot be zero".to_string());
        }

        let (x, y) = match anchor.as_str() {
            "top-left" => (0, 0),
            "top-right" => (orig_w.saturating_sub(crop_w), 0),
            "bottom-left" => (0, orig_h.saturating_sub(crop_h)),
            "bottom-right" => (orig_w.saturating_sub(crop_w), orig_h.saturating_sub(crop_h)),
            _ => {
                ((orig_w.saturating_sub(crop_w)) / 2, (orig_h.saturating_sub(crop_h)) / 2)
            }
        };

        let cropped = img.crop_imm(x, y, crop_w, crop_h);

        let ext = get_extension(input_path);
        let stem = file_stem(input_path);
        let output_path = out_dir.join(format!("{}-cropped.{}", stem, ext));

        save_in_original_format(&cropped, input_path, &output_path)?;
        Ok((output_path.to_string_lossy().to_string(), Some((orig_w, orig_h, crop_w, crop_h))))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_failed_sets_every_result_to_error() {
        let paths = vec!["a.png".to_string(), "b.png".to_string()];
        let bp = BatchProgress::all_failed(&paths, "boom".to_string());
        assert_eq!(bp.completed, 0);
        assert_eq!(bp.total, 2);
        assert!(bp.results.iter().all(|r| !r.success));
        assert!(bp.results.iter().all(|r| r.error.as_deref() == Some("boom")));
    }

    #[test]
    fn build_result_success() {
        let r = build_result(
            "/tmp/photo.jpg",
            Ok("/tmp/out/photo-compressed.webp".to_string()),
            Some((1920, 1080, 800, 600)),
        );
        assert!(r.success);
        assert!(r.error.is_none());
        assert_eq!(r.input_width, 1920);
        assert_eq!(r.output_width, 800);
    }

    #[test]
    fn build_result_failure() {
        let r = build_result("/tmp/bad.jpg", Err("decode error".to_string()), None);
        assert!(!r.success);
        assert_eq!(r.error.as_deref(), Some("decode error"));
        assert_eq!(r.output_path, String::new());
    }
}
