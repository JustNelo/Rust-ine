use image::{DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Write};
use std::path::PathBuf;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::utils::{ensure_output_dir, file_stem as get_file_stem};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FaviconResult {
    pub zip_path: String,
    pub generated_files: Vec<String>,
    pub errors: Vec<String>,
}

/// Sizes to generate: (filename, width, height)
const FAVICON_SIZES: &[(&str, u32, u32)] = &[
    ("favicon-16x16.png", 16, 16),
    ("favicon-32x32.png", 32, 32),
    ("favicon-48x48.png", 48, 48),
    ("apple-touch-icon.png", 180, 180),
    ("android-chrome-192x192.png", 192, 192),
    ("android-chrome-512x512.png", 512, 512),
];

/// ICO sizes to embed
const ICO_SIZES: &[u32] = &[16, 32, 48];

fn resize_to_png_bytes(img: &DynamicImage, w: u32, h: u32) -> Result<Vec<u8>, String> {
    let resized = img.resize_exact(w, h, image::imageops::FilterType::Lanczos3);
    let mut buf = Cursor::new(Vec::new());
    resized
        .write_to(&mut buf, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode {}x{} PNG: {}", w, h, e))?;
    Ok(buf.into_inner())
}

/// Build a minimal ICO file containing multiple sizes.
/// ICO format: header (6 bytes) + entries (16 bytes each) + image data (PNG payloads)
fn build_ico(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut png_payloads: Vec<(u32, Vec<u8>)> = Vec::new();
    for &size in ICO_SIZES {
        let png_data = resize_to_png_bytes(img, size, size)?;
        png_payloads.push((size, png_data));
    }

    let num_images = png_payloads.len() as u16;
    let mut ico = Vec::new();

    // ICO header: reserved(2) + type=1(2) + count(2)
    ico.extend_from_slice(&0u16.to_le_bytes()); // reserved
    ico.extend_from_slice(&1u16.to_le_bytes()); // type: 1 = ICO
    ico.extend_from_slice(&num_images.to_le_bytes());

    // Calculate data offset: header(6) + entries(16 * count)
    let header_size = 6 + 16 * png_payloads.len();
    let mut data_offset = header_size;

    // Write directory entries
    for (size, png_data) in &png_payloads {
        let dim = if *size >= 256 { 0u8 } else { *size as u8 };
        ico.push(dim); // width
        ico.push(dim); // height
        ico.push(0); // color palette count
        ico.push(0); // reserved
        ico.extend_from_slice(&1u16.to_le_bytes()); // color planes
        ico.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
        ico.extend_from_slice(&(png_data.len() as u32).to_le_bytes()); // data size
        ico.extend_from_slice(&(data_offset as u32).to_le_bytes()); // data offset
        data_offset += png_data.len();
    }

    // Write PNG payloads
    for (_, png_data) in &png_payloads {
        ico.extend_from_slice(png_data);
    }

    Ok(ico)
}

fn generate_webmanifest() -> String {
    serde_json::json!({
        "name": "",
        "short_name": "",
        "icons": [
            {
                "src": "/android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "/android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png"
            }
        ],
        "theme_color": "#ffffff",
        "background_color": "#ffffff",
        "display": "standalone"
    })
    .to_string()
}

pub fn generate_favicons(
    image_path: &str,
    output_dir: &str,
) -> FaviconResult {
    let mut result = FaviconResult {
        zip_path: String::new(),
        generated_files: Vec::new(),
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let img = match image::open(image_path) {
        Ok(i) => i,
        Err(e) => {
            result.errors.push(format!("Cannot open '{}': {}", image_path, e));
            return result;
        }
    };

    let stem = get_file_stem(image_path);

    let zip_path = out_dir.join(format!("{}-favicons.zip", stem));

    let zip_file = match std::fs::File::create(&zip_path) {
        Ok(f) => f,
        Err(e) => {
            result.errors.push(format!("Cannot create ZIP: {}", e));
            return result;
        }
    };

    let mut zip = ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Generate PNG sizes
    for (filename, w, h) in FAVICON_SIZES {
        match resize_to_png_bytes(&img, *w, *h) {
            Ok(png_data) => {
                if let Err(e) = zip.start_file(*filename, options) {
                    result.errors.push(format!("{}: {}", filename, e));
                    continue;
                }
                if let Err(e) = zip.write_all(&png_data) {
                    result.errors.push(format!("{}: {}", filename, e));
                    continue;
                }
                result.generated_files.push(filename.to_string());
            }
            Err(e) => {
                result.errors.push(e);
            }
        }
    }

    // Generate favicon.ico
    match build_ico(&img) {
        Ok(ico_data) => {
            if let Err(e) = zip.start_file("favicon.ico", options) {
                result.errors.push(format!("favicon.ico: {}", e));
            } else if let Err(e) = zip.write_all(&ico_data) {
                result.errors.push(format!("favicon.ico: {}", e));
            } else {
                result.generated_files.push("favicon.ico".to_string());
            }
        }
        Err(e) => {
            result.errors.push(format!("favicon.ico: {}", e));
        }
    }

    // Generate site.webmanifest
    let manifest = generate_webmanifest();
    if let Err(e) = zip.start_file("site.webmanifest", options) {
        result.errors.push(format!("site.webmanifest: {}", e));
    } else if let Err(e) = zip.write_all(manifest.as_bytes()) {
        result.errors.push(format!("site.webmanifest: {}", e));
    } else {
        result.generated_files.push("site.webmanifest".to_string());
    }

    if let Err(e) = zip.finish() {
        result.errors.push(format!("Cannot finalize ZIP: {}", e));
    }

    result.zip_path = zip_path.to_string_lossy().to_string();
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webmanifest_is_valid_json() {
        let manifest = generate_webmanifest();
        let parsed: serde_json::Value = serde_json::from_str(&manifest)
            .expect("webmanifest should be valid JSON");
        assert!(parsed.get("icons").is_some());
        let icons = parsed["icons"].as_array().unwrap();
        assert_eq!(icons.len(), 2);
        assert_eq!(icons[0]["sizes"], "192x192");
        assert_eq!(icons[1]["sizes"], "512x512");
    }

    #[test]
    fn favicon_sizes_constant_is_correct() {
        assert!(FAVICON_SIZES.len() >= 4);
        assert!(FAVICON_SIZES.iter().any(|(name, _, _)| *name == "apple-touch-icon.png"));
        assert!(FAVICON_SIZES.iter().any(|(name, _, _)| *name == "favicon-16x16.png"));
    }

    #[test]
    fn ico_sizes_all_fit_in_u8() {
        for &s in ICO_SIZES {
            assert!(s <= 256, "ICO size {} exceeds 256", s);
        }
    }
}
