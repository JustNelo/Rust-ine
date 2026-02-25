use image::{DynamicImage, GenericImageView, RgbaImage};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::utils::ensure_output_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpriteSheetResult {
    pub image_path: String,
    pub atlas_path: String,
    pub sprite_count: usize,
    pub sheet_width: u32,
    pub sheet_height: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
struct AtlasFrame {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

#[derive(Debug, Serialize)]
struct AtlasJson {
    frames: HashMap<String, AtlasFrame>,
}

/// Generate a sprite sheet from multiple images arranged in a grid.
/// All images are resized to match the largest width/height found.
/// Outputs the spritesheet PNG and a JSON atlas file.
pub fn generate_spritesheet(
    image_paths: &[String],
    columns: u32,
    padding: u32,
    output_dir: &str,
) -> SpriteSheetResult {
    let mut result = SpriteSheetResult {
        image_path: String::new(),
        atlas_path: String::new(),
        sprite_count: 0,
        sheet_width: 0,
        sheet_height: 0,
        errors: Vec::new(),
    };

    if image_paths.is_empty() {
        result.errors.push("No images provided".to_string());
        return result;
    }

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let cols = columns.max(1);

    // Load all images
    let mut images: Vec<(String, DynamicImage)> = Vec::new();
    for path in image_paths {
        match image::open(path) {
            Ok(img) => {
                let name = std::path::Path::new(path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("sprite")
                    .to_string();
                images.push((name, img));
            }
            Err(e) => {
                result.errors.push(format!("Cannot open '{}': {}", path, e));
            }
        }
    }

    if images.is_empty() {
        result.errors.push("No valid images loaded".to_string());
        return result;
    }

    // Find max cell dimensions
    let max_w = images.iter().map(|(_, img)| img.width()).max().unwrap_or(64);
    let max_h = images.iter().map(|(_, img)| img.height()).max().unwrap_or(64);

    let count = images.len() as u32;
    let rows = count.div_ceil(cols);

    let sheet_width = cols * max_w + (cols + 1) * padding;
    let sheet_height = rows * max_h + (rows + 1) * padding;

    let mut sheet = RgbaImage::new(sheet_width, sheet_height);

    // Fill with transparent
    for pixel in sheet.pixels_mut() {
        *pixel = image::Rgba([0, 0, 0, 0]);
    }

    let mut atlas_frames: Vec<(String, AtlasFrame)> = Vec::new();

    for (i, (name, img)) in images.iter().enumerate() {
        let col = (i as u32) % cols;
        let row = (i as u32) / cols;

        let x = padding + col * (max_w + padding);
        let y = padding + row * (max_h + padding);

        // Center the image within the cell if smaller than max
        let (iw, ih) = img.dimensions();
        let offset_x = (max_w.saturating_sub(iw)) / 2;
        let offset_y = (max_h.saturating_sub(ih)) / 2;

        let rgba = img.to_rgba8();
        image::imageops::overlay(&mut sheet, &rgba, (x + offset_x) as i64, (y + offset_y) as i64);

        atlas_frames.push((
            name.clone(),
            AtlasFrame {
                x,
                y,
                w: iw.min(max_w),
                h: ih.min(max_h),
            },
        ));

        result.sprite_count += 1;
    }

    // Save spritesheet PNG
    let image_path = out_dir.join("spritesheet.png");
    match sheet.save(&image_path) {
        Ok(_) => {
            result.image_path = image_path.to_string_lossy().to_string();
            result.sheet_width = sheet_width;
            result.sheet_height = sheet_height;
        }
        Err(e) => {
            result.errors.push(format!("Cannot save spritesheet: {}", e));
            return result;
        }
    }

    // Build and save JSON atlas
    let atlas_json = build_atlas_json(atlas_frames);
    let atlas_path = out_dir.join("spritesheet.json");
    match std::fs::write(&atlas_path, atlas_json) {
        Ok(_) => {
            result.atlas_path = atlas_path.to_string_lossy().to_string();
        }
        Err(e) => {
            result.errors.push(format!("Cannot save atlas JSON: {}", e));
        }
    }

    result
}

fn build_atlas_json(frames: Vec<(String, AtlasFrame)>) -> String {
    let atlas = AtlasJson {
        frames: frames.into_iter().collect(),
    };
    serde_json::to_string_pretty(&atlas).unwrap_or_else(|_| "{}" .to_string())
}
