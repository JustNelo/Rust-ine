use image::{ImageBuffer, Rgba};
use qrcode::QrCode;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::utils::ensure_output_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QrResult {
    pub output_path: String,
    pub size: u32,
    pub errors: Vec<String>,
}

/// Generate a QR code PNG from the given text content.
/// The output image is `size × size` pixels with a white background and dark modules.
pub fn generate_qr(
    text: &str,
    size: u32,
    output_dir: &str,
) -> QrResult {
    let mut result = QrResult {
        output_path: String::new(),
        size,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let code = match QrCode::new(text.as_bytes()) {
        Ok(c) => c,
        Err(e) => {
            result.errors.push(format!("QR encoding failed: {}", e));
            return result;
        }
    };

    let module_count = code.width() as u32;
    let module_size = (size / (module_count + 8)).max(1);
    let margin = (size.saturating_sub(module_count * module_size)) / 2;
    let img_size = module_count * module_size + margin * 2;

    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_pixel(img_size, img_size, Rgba([255, 255, 255, 255]));

    let dark = Rgba([30, 30, 30, 255]);

    for (y, row) in code.to_colors().chunks(module_count as usize).enumerate() {
        for (x, &color) in row.iter().enumerate() {
            if color == qrcode::Color::Dark {
                let px = margin + (x as u32) * module_size;
                let py = margin + (y as u32) * module_size;
                for dy in 0..module_size {
                    for dx in 0..module_size {
                        if px + dx < img_size && py + dy < img_size {
                            img.put_pixel(px + dx, py + dy, dark);
                        }
                    }
                }
            }
        }
    }

    let output_path = out_dir.join("qrcode.png");
    match img.save(&output_path) {
        Ok(_) => {
            result.output_path = output_path.to_string_lossy().to_string();
        }
        Err(e) => {
            result.errors.push(format!("Cannot save QR image: {}", e));
        }
    }

    result
}
