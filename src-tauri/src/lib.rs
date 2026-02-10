mod image_ops;
mod pdf_ops;

use image_ops::BatchProgress;
use pdf_ops::PdfExtractionResult;
use std::path::Path;
use tauri::Manager;

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
    input_paths: Vec<String>,
    quality: f32,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    for p in &input_paths {
        validate_path(p)?;
    }
    let result =
        tokio::task::spawn_blocking(move || image_ops::compress_to_webp(input_paths, quality, output_dir))
            .await
            .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn convert_images(
    input_paths: Vec<String>,
    output_format: String,
    output_dir: String,
) -> Result<BatchProgress, String> {
    validate_path(&output_dir)?;
    for p in &input_paths {
        validate_path(p)?;
    }
    let result = tokio::task::spawn_blocking(move || {
        image_ops::convert_images(input_paths, output_format, output_dir)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;
    Ok(result)
}

#[tauri::command]
async fn extract_pdf_images(
    pdf_path: String,
    output_dir: String,
) -> Result<PdfExtractionResult, String> {
    validate_path(&pdf_path)?;
    validate_path(&output_dir)?;
    let result = tokio::task::spawn_blocking(move || {
        pdf_ops::extract_images_from_pdf(&pdf_path, &output_dir)
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
            extract_pdf_images
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
