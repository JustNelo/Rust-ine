mod color_ops;
mod favicon_ops;
mod gif_ops;
mod image_ops;
mod metadata_ops;
mod pdf_builder_ops;
mod pdf_ops;
mod pdf_split_ops;
mod qr_ops;
mod rename_ops;
mod sprite_ops;
mod utils;

use image_ops::BatchProgress;
use metadata_ops::ImageMetadata;
use pdf_builder_ops::{MergePdfOptions, MergePdfResult, PageThumbnail, PdfBuilderItem};
use color_ops::PaletteResult;
use favicon_ops::FaviconResult;
use gif_ops::AnimationResult;
use pdf_ops::{ImagesToPdfResult, PdfCompressResult, PdfExtractionResult, PdfProtectResult, PdfToImagesResult};
use pdf_split_ops::PdfSplitResult;
use qr_ops::QrResult;
use rename_ops::RenameResult;
use sprite_ops::SpriteSheetResult;
use std::path::{Path, Component};
use std::sync::Arc;
use tauri::Manager;

/// Resolved pdfium library path, computed once at startup and shared via tauri::State.
pub struct PdfiumPath(pub Arc<String>);

fn resolve_pdfium_path(app_handle: &tauri::AppHandle) -> Result<String, String> {
    let lib_name = if cfg!(target_os = "windows") {
        "pdfium.dll"
    } else if cfg!(target_os = "macos") {
        "libpdfium.dylib"
    } else {
        "libpdfium.so"
    };

    let candidates: Vec<std::path::PathBuf> = vec![
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|d| d.join(lib_name)),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(lib_name))),
        Some(std::path::PathBuf::from(format!("resources/{}", lib_name))),
    ]
    .into_iter()
    .flatten()
    .collect();

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    Err(format!(
        "Pdfium library not found. Searched: {}",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

fn validate_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if p.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(format!("Path traversal detected: {}", path));
    }
    if !p.is_absolute() {
        return Err(format!("Only absolute paths are allowed: {}", path));
    }
    // If the path already exists, resolve symlinks and re-validate
    if p.exists() {
        if let Ok(canonical) = std::fs::canonicalize(p) {
            if canonical.components().any(|c| matches!(c, Component::ParentDir)) {
                return Err(format!("Symlink traversal detected: {}", path));
            }
        }
    }
    Ok(())
}

fn validate_paths(paths: &[String]) -> Result<(), String> {
    for p in paths {
        validate_path(p)?;
    }
    Ok(())
}

#[tauri::command]
async fn compress_webp(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    quality: f32,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result =
        tokio::task::spawn_blocking(move || image_ops::compress_to_webp(input_paths, quality, output_dir, app_handle))
            .await
            .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn convert_images(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    output_format: String,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        image_ops::convert_images(input_paths, output_format, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn extract_pdf_images(
    pdfium: tauri::State<'_, PdfiumPath>,
    pdf_path: String,
    output_dir: String,
) -> Result<PdfExtractionResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;

    let pdfium_lib_path = pdfium.0.clone();

    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::extract_images_from_pdf(&pdf_path, &output_dir, &pdfium_lib_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn resize_images(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    mode: String,
    width: u32,
    height: u32,
    percentage: u32,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        image_ops::resize_images(input_paths, mode, width, height, percentage, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn strip_metadata(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        image_ops::strip_metadata(input_paths, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn add_watermark(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    text: String,
    position: String,
    opacity: f32,
    font_size: f32,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        image_ops::add_watermark(input_paths, text, position, opacity, font_size, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn images_to_pdf(
    input_paths: Vec<String>,
    output_path: String,
) -> Result<ImagesToPdfResult, String> {
    validate_path(&output_path)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::images_to_pdf(input_paths, &output_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn read_metadata(
    file_path: String,
) -> Result<ImageMetadata, String> {
    validate_path(&file_path)?;
    tokio::task::spawn_blocking(move || {
        metadata_ops::read_image_metadata(&file_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
async fn generate_pdf_thumbnails(
    pdfium: tauri::State<'_, PdfiumPath>,
    file_paths: Vec<String>,
) -> Result<Vec<PageThumbnail>, String> {
    validate_paths(&file_paths)?;
    let pdfium_lib_path = pdfium.0.clone();
    let result = tokio::task::spawn_blocking(move || {
        pdf_builder_ops::generate_thumbnails_batch(file_paths, &pdfium_lib_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn merge_to_pdf(
    items: Vec<PdfBuilderItem>,
    options: MergePdfOptions,
) -> Result<MergePdfResult, String> {
    validate_path(&options.output_path)?;
    let item_paths: Vec<String> = items.iter().map(|i| i.source_path.clone()).collect();
    validate_paths(&item_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        pdf_builder_ops::merge_to_pdf(items, options)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn optimize_images(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        image_ops::optimize_lossless(input_paths, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn crop_images(
    app_handle: tauri::AppHandle,
    input_paths: Vec<String>,
    ratio: String,
    anchor: String,
    width: u32,
    height: u32,
    crop_x: Option<u32>,
    crop_y: Option<u32>,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    validate_paths(&input_paths)?;
    let result = tokio::task::spawn_blocking(move || {
        image_ops::crop_images(input_paths, ratio, anchor, width, height, crop_x, crop_y, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn pdf_to_images(
    pdfium: tauri::State<'_, PdfiumPath>,
    pdf_path: String,
    output_dir: String,
    format: String,
    dpi: u32,
) -> Result<PdfToImagesResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;
    let pdfium_lib_path = pdfium.0.clone();
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::pdf_to_images(&pdf_path, &output_dir, &pdfium_lib_path, &format, dpi)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn split_pdf(
    pdf_path: String,
    ranges: String,
    output_dir: String,
) -> Result<PdfSplitResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        pdf_split_ops::split_pdf(&pdf_path, &ranges, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn extract_palette(
    image_path: String,
    num_colors: usize,
) -> Result<PaletteResult, String> {
    validate_path(&image_path)?;
    tokio::task::spawn_blocking(move || {
        color_ops::extract_palette(&image_path, num_colors)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
async fn compress_pdf_cmd(
    pdf_path: String,
    quality: u8,
    output_dir: String,
) -> Result<PdfCompressResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::compress_pdf(&pdf_path, quality, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn generate_favicons(
    image_path: String,
    output_dir: String,
) -> Result<FaviconResult, String> {
    validate_path(&image_path)?;
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        favicon_ops::generate_favicons(&image_path, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn create_gif(
    image_paths: Vec<String>,
    delay_ms: u16,
    loop_count: u16,
    output_dir: String,
) -> Result<AnimationResult, String> {
    for path in &image_paths {
        validate_path(path)?;
    }
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        gif_ops::create_gif(&image_paths, delay_ms, loop_count, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn generate_spritesheet(
    image_paths: Vec<String>,
    columns: u32,
    padding: u32,
    output_dir: String,
) -> Result<SpriteSheetResult, String> {
    for path in &image_paths {
        validate_path(path)?;
    }
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        sprite_ops::generate_spritesheet(&image_paths, columns, padding, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn protect_pdf_cmd(
    pdfium: tauri::State<'_, PdfiumPath>,
    pdf_path: String,
    password: String,
    output_dir: String,
) -> Result<PdfProtectResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;
    let pdfium_path = pdfium.0.clone();
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::protect_pdf(&pdfium_path, &pdf_path, &password, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn unlock_pdf_cmd(
    pdfium: tauri::State<'_, PdfiumPath>,
    pdf_path: String,
    password: String,
    output_dir: String,
) -> Result<PdfProtectResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;
    let pdfium_path = pdfium.0.clone();
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::unlock_pdf(&pdfium_path, &pdf_path, &password, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn bulk_rename_cmd(
    input_paths: Vec<String>,
    pattern: String,
    start_index: u32,
    output_dir: String,
) -> Result<RenameResult, String> {
    validate_paths(&input_paths)?;
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        rename_ops::bulk_rename(&input_paths, &pattern, start_index, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn generate_qr_cmd(
    text: String,
    size: u32,
    output_dir: String,
) -> Result<QrResult, String> {
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        qr_ops::generate_qr(&text, size, &output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn image_to_base64(image_path: String) -> Result<String, String> {
    validate_path(&image_path)?;
    tokio::task::spawn_blocking(move || {
        let bytes = std::fs::read(&image_path)
            .map_err(|e| format!("Cannot read file: {}", e))?;
        let ext = Path::new(&image_path)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or("png".to_string());
        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            "svg" => "image/svg+xml",
            "tiff" | "tif" => "image/tiff",
            _ => "application/octet-stream",
        };
        let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            compress_webp,
            convert_images,
            extract_pdf_images,
            resize_images,
            strip_metadata,
            add_watermark,
            optimize_images,
            crop_images,
            images_to_pdf,
            read_metadata,
            generate_pdf_thumbnails,
            merge_to_pdf,
            pdf_to_images,
            split_pdf,
            extract_palette,
            compress_pdf_cmd,
            generate_favicons,
            create_gif,
            generate_spritesheet,
            protect_pdf_cmd,
            unlock_pdf_cmd,
            image_to_base64,
            generate_qr_cmd,
            bulk_rename_cmd
        ])
        .setup(|app| {
            let png_bytes = include_bytes!("../icons/icon.png");
            if let Ok(img) = image::load_from_memory(png_bytes) {
                let rgba = img.to_rgba8();
                let (w, h) = (rgba.width(), rgba.height());
                let icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(icon);
                }
            }

            // Resolve pdfium library path once at startup
            let pdfium_path = resolve_pdfium_path(app.handle())
                .unwrap_or_default();
            app.manage(PdfiumPath(Arc::new(pdfium_path)));

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Fatal: failed to start Rust-ine — {}", e);
            std::process::exit(1);
        });
}
