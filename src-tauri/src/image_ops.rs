use image::{DynamicImage, ImageFormat, ImageReader};
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
