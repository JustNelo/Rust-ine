use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::utils::{ensure_output_dir, file_stem};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SvgRasterizeResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
}

pub fn rasterize_svg(
    input_path: &str,
    target_width: u32,
    output_format: &str,
    output_dir: &str,
) -> Result<SvgRasterizeResult, String> {
    ensure_output_dir(Path::new(output_dir))?;

    let svg_data = fs::read(input_path)
        .map_err(|e| format!("Cannot read SVG file: {}", e))?;

    let tree = resvg::usvg::Tree::from_data(&svg_data, &resvg::usvg::Options::default())
        .map_err(|e| format!("Cannot parse SVG: {}", e))?;

    let original_size = tree.size();
    let scale = target_width as f32 / original_size.width();
    let target_height = (original_size.height() * scale) as u32;

    let mut pixmap = resvg::tiny_skia::Pixmap::new(target_width, target_height)
        .ok_or_else(|| "Cannot create pixel buffer".to_string())?;

    let transform = resvg::tiny_skia::Transform::from_scale(scale, scale);
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    let stem = file_stem(input_path);
    let format_lower = output_format.to_lowercase();

    let (ext, img_format) = match format_lower.as_str() {
        "webp" => ("webp", None),
        _ => ("png", Some(ImageFormat::Png)),
    };

    let output_path = Path::new(output_dir).join(format!("{}-{}px.{}", stem, target_width, ext));

    if let Some(fmt) = img_format {
        // PNG output via image crate
        let rgba_data = pixmap.data();
        let img_buf: image::RgbaImage =
            image::ImageBuffer::from_raw(target_width, target_height, rgba_data.to_vec())
                .ok_or_else(|| "Cannot create image buffer".to_string())?;

        img_buf
            .save_with_format(&output_path, fmt)
            .map_err(|e| format!("Cannot save {}: {}", ext.to_uppercase(), e))?;
    } else {
        // WebP output via webp crate
        let rgba_data = pixmap.data();
        let encoder = webp::Encoder::from_rgba(rgba_data, target_width, target_height);
        let webp_data = encoder.encode(90.0);
        fs::write(&output_path, &*webp_data)
            .map_err(|e| format!("Cannot write WebP file: {}", e))?;
    }

    Ok(SvgRasterizeResult {
        output_path: output_path.to_string_lossy().to_string(),
        width: target_width,
        height: target_height,
    })
}
