use gif::{Encoder, Frame, Repeat};
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::PathBuf;

use crate::utils::ensure_output_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnimationResult {
    pub output_path: String,
    pub frame_count: usize,
    pub format: String,
    pub errors: Vec<String>,
}

/// Create an animated GIF from a sequence of image paths.
/// All frames are resized to match the first frame's dimensions.
pub fn create_gif(
    image_paths: &[String],
    delay_ms: u16,
    loop_count: u16,
    output_dir: &str,
) -> AnimationResult {
    let mut result = AnimationResult {
        output_path: String::new(),
        frame_count: 0,
        format: "gif".to_string(),
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

    // Load first image to determine dimensions
    let first_img = match image::open(&image_paths[0]) {
        Ok(img) => img,
        Err(e) => {
            result.errors.push(format!("Cannot open first image: {}", e));
            return result;
        }
    };

    let (width, height) = first_img.dimensions();

    // GIF dimensions are u16
    let gif_width = width.min(u16::MAX as u32) as u16;
    let gif_height = height.min(u16::MAX as u32) as u16;

    let output_path = out_dir.join("animation.gif");
    let file = match File::create(&output_path) {
        Ok(f) => f,
        Err(e) => {
            result.errors.push(format!("Cannot create output file: {}", e));
            return result;
        }
    };

    let mut encoder = match Encoder::new(file, gif_width, gif_height, &[]) {
        Ok(enc) => enc,
        Err(e) => {
            result.errors.push(format!("Cannot create GIF encoder: {}", e));
            return result;
        }
    };

    // Set repeat behavior
    let repeat = if loop_count == 0 {
        Repeat::Infinite
    } else {
        Repeat::Finite(loop_count)
    };
    if let Err(e) = encoder.set_repeat(repeat) {
        result.errors.push(format!("Cannot set loop: {}", e));
        return result;
    }

    // GIF delay is in centiseconds (1/100th of a second)
    let delay_cs = (delay_ms / 10).max(1);

    for (i, path) in image_paths.iter().enumerate() {
        let img = match image::open(path) {
            Ok(img) => img,
            Err(e) => {
                result.errors.push(format!("Frame {}: {}", i + 1, e));
                continue;
            }
        };

        // Resize to match first frame dimensions
        let resized = img.resize_exact(
            gif_width as u32,
            gif_height as u32,
            image::imageops::FilterType::Triangle,
        );

        let rgba = resized.to_rgba8();
        let mut pixels = rgba.into_raw();

        let mut frame = Frame::from_rgba_speed(gif_width, gif_height, &mut pixels, 10);
        frame.delay = delay_cs;

        if let Err(e) = encoder.write_frame(&frame) {
            result.errors.push(format!("Frame {}: write error — {}", i + 1, e));
            continue;
        }

        result.frame_count += 1;
    }

    result.output_path = output_path.to_string_lossy().to_string();
    result
}
