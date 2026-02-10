use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfExtractionResult {
    pub pdf_path: String,
    pub output_dir: String,
    pub extracted_count: usize,
    pub errors: Vec<String>,
}

fn detect_image_format(data: &[u8]) -> (&str, &str) {
    if data.len() >= 8 && data[0..8] == [137, 80, 78, 71, 13, 10, 26, 10] {
        ("png", "png")
    } else if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xD8 {
        ("jpeg", "jpg")
    } else if data.len() >= 4 && &data[0..4] == b"RIFF" {
        ("webp", "webp")
    } else if data.len() >= 2 && &data[0..2] == b"BM" {
        ("bmp", "bmp")
    } else if data.len() >= 4
        && (data[0..4] == [0x49, 0x49, 0x2A, 0x00] || data[0..4] == [0x4D, 0x4D, 0x00, 0x2A])
    {
        ("tiff", "tiff")
    } else {
        ("raw", "bin")
    }
}

pub fn extract_images_from_pdf(pdf_path: &str, output_dir: &str) -> PdfExtractionResult {
    let mut result = PdfExtractionResult {
        pdf_path: pdf_path.to_string(),
        output_dir: output_dir.to_string(),
        extracted_count: 0,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if !out_dir.exists() {
        if let Err(e) = fs::create_dir_all(&out_dir) {
            result
                .errors
                .push(format!("Cannot create output directory: {}", e));
            return result;
        }
    }

    let doc = match Document::load(pdf_path) {
        Ok(d) => d,
        Err(e) => {
            result
                .errors
                .push(format!("Cannot open PDF '{}': {}", pdf_path, e));
            return result;
        }
    };

    let pdf_stem = Path::new(pdf_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("pdf");

    let mut image_index: usize = 0;

    for (object_id, _) in &doc.objects {
        if let Ok(stream) = doc.get_object(*object_id).and_then(|obj| obj.as_stream()) {
            let subtype = stream
                .dict
                .get(b"Subtype")
                .ok()
                .and_then(|s| s.as_name().ok())
                .map(|n| std::str::from_utf8(n).unwrap_or(""))
                .unwrap_or("");

            if subtype != "Image" {
                continue;
            }

            let raw_data = match stream.decompressed_content() {
                Ok(data) => data,
                Err(_) => {
                    stream.content.clone()
                }
            };

            if raw_data.is_empty() {
                continue;
            }

            let filter = stream
                .dict
                .get(b"Filter")
                .ok()
                .and_then(|f| f.as_name().ok())
                .map(|n| std::str::from_utf8(n).unwrap_or(""))
                .unwrap_or("");

            let width = stream
                .dict
                .get(b"Width")
                .ok()
                .and_then(|w| w.as_i64().ok())
                .unwrap_or(0);
            let height = stream
                .dict
                .get(b"Height")
                .ok()
                .and_then(|h| h.as_i64().ok())
                .unwrap_or(0);
            let bits_per_component = stream
                .dict
                .get(b"BitsPerComponent")
                .ok()
                .and_then(|b| b.as_i64().ok())
                .unwrap_or(8);

            let color_space = stream
                .dict
                .get(b"ColorSpace")
                .ok()
                .and_then(|cs| cs.as_name().ok())
                .map(|n| std::str::from_utf8(n).unwrap_or(""))
                .unwrap_or("");

            image_index += 1;

            match filter {
                "DCTDecode" => {
                    let out_path = out_dir.join(format!("{}_{}.jpg", pdf_stem, image_index));
                    match fs::write(&out_path, &stream.content) {
                        Ok(_) => result.extracted_count += 1,
                        Err(e) => result.errors.push(format!(
                            "Failed to write JPEG image {}: {}",
                            image_index, e
                        )),
                    }
                }
                "FlateDecode" => {
                    if width > 0 && height > 0 {
                        let channels: u32 = match color_space {
                            "DeviceRGB" => 3,
                            "DeviceCMYK" => 4,
                            "DeviceGray" => 1,
                            _ => 3,
                        };

                        let expected_size =
                            (width as usize) * (height as usize) * (channels as usize) * (bits_per_component as usize / 8).max(1);

                        if raw_data.len() >= expected_size {
                            match save_raw_as_png(
                                &raw_data,
                                width as u32,
                                height as u32,
                                channels,
                                &out_dir,
                                &format!("{}_{}", pdf_stem, image_index),
                            ) {
                                Ok(_) => result.extracted_count += 1,
                                Err(e) => result.errors.push(format!(
                                    "Failed to save raw image {} as PNG: {}",
                                    image_index, e
                                )),
                            }
                        } else {
                            let (_, ext) = detect_image_format(&raw_data);
                            let out_path =
                                out_dir.join(format!("{}_{}.{}", pdf_stem, image_index, ext));
                            match fs::write(&out_path, &raw_data) {
                                Ok(_) => result.extracted_count += 1,
                                Err(e) => result.errors.push(format!(
                                    "Failed to write image {}: {}",
                                    image_index, e
                                )),
                            }
                        }
                    }
                }
                "JPXDecode" => {
                    let out_path = out_dir.join(format!("{}_{}.jp2", pdf_stem, image_index));
                    match fs::write(&out_path, &stream.content) {
                        Ok(_) => result.extracted_count += 1,
                        Err(e) => result.errors.push(format!(
                            "Failed to write JP2 image {}: {}",
                            image_index, e
                        )),
                    }
                }
                "CCITTFaxDecode" => {
                    let out_path = out_dir.join(format!("{}_{}.tiff", pdf_stem, image_index));
                    match fs::write(&out_path, &stream.content) {
                        Ok(_) => result.extracted_count += 1,
                        Err(e) => result.errors.push(format!(
                            "Failed to write TIFF image {}: {}",
                            image_index, e
                        )),
                    }
                }
                _ => {
                    let (_, ext) = detect_image_format(&raw_data);
                    let out_path =
                        out_dir.join(format!("{}_{}.{}", pdf_stem, image_index, ext));
                    match fs::write(&out_path, &raw_data) {
                        Ok(_) => result.extracted_count += 1,
                        Err(e) => result.errors.push(format!(
                            "Failed to write image {}: {}",
                            image_index, e
                        )),
                    }
                }
            }
        }
    }

    result
}

fn save_raw_as_png(
    raw_data: &[u8],
    width: u32,
    height: u32,
    channels: u32,
    out_dir: &Path,
    name: &str,
) -> Result<(), String> {
    let out_path = out_dir.join(format!("{}.png", name));

    let img = match channels {
        1 => {
            let expected = (width * height) as usize;
            let buf = if raw_data.len() >= expected {
                raw_data[..expected].to_vec()
            } else {
                let mut padded = raw_data.to_vec();
                padded.resize(expected, 0);
                padded
            };
            image::GrayImage::from_raw(width, height, buf)
                .map(image::DynamicImage::ImageLuma8)
                .ok_or_else(|| "Failed to create grayscale image".to_string())?
        }
        3 => {
            let expected = (width * height * 3) as usize;
            let buf = if raw_data.len() >= expected {
                raw_data[..expected].to_vec()
            } else {
                let mut padded = raw_data.to_vec();
                padded.resize(expected, 0);
                padded
            };
            image::RgbImage::from_raw(width, height, buf)
                .map(image::DynamicImage::ImageRgb8)
                .ok_or_else(|| "Failed to create RGB image".to_string())?
        }
        4 => {
            let expected = (width * height * 4) as usize;
            let buf = if raw_data.len() >= expected {
                raw_data[..expected].to_vec()
            } else {
                let mut padded = raw_data.to_vec();
                padded.resize(expected, 0);
                padded
            };
            image::RgbaImage::from_raw(width, height, buf)
                .map(image::DynamicImage::ImageRgba8)
                .ok_or_else(|| "Failed to create RGBA image".to_string())?
        }
        _ => return Err(format!("Unsupported channel count: {}", channels)),
    };

    img.save(&out_path)
        .map_err(|e| format!("Cannot save PNG: {}", e))?;

    Ok(())
}
