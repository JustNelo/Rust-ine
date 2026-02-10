mod image_ops;
mod pdf_ops;

use image_ops::BatchProgress;
use pdf_ops::{ImagesToPdfResult, PdfExtractionResult};
use std::path::Path;
use tauri::Manager;

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
    if path.contains("..") {
        return Err(format!("Path traversal detected: {}", path));
    }
    if !p.is_absolute() {
        return Err(format!("Only absolute paths are allowed: {}", path));
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
    for p in &input_paths {
        validate_path(p)?;
    }
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
    for p in &input_paths {
        validate_path(p)?;
    }
    let result = tokio::task::spawn_blocking(move || {
        image_ops::convert_images(input_paths, output_format, output_dir, app_handle)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn extract_pdf_images(
    app_handle: tauri::AppHandle,
    pdf_path: String,
    output_dir: String,
) -> Result<PdfExtractionResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;

    let pdfium_lib_path = resolve_pdfium_path(&app_handle)?;

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
    for p in &input_paths {
        validate_path(p)?;
    }
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
    for p in &input_paths {
        validate_path(p)?;
    }
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
    for p in &input_paths {
        validate_path(p)?;
    }
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
    for p in &input_paths {
        validate_path(p)?;
    }
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::images_to_pdf(input_paths, &output_path)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            compress_webp,
            convert_images,
            extract_pdf_images,
            resize_images,
            strip_metadata,
            add_watermark,
            images_to_pdf
        ])
        .setup(|app| {
            let png_bytes = include_bytes!("../icons/icon.png");
            let img = image::load_from_memory(png_bytes).expect("failed to decode icon");
            let rgba = img.to_rgba8();
            let (w, h) = (rgba.width(), rgba.height());
            let icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
