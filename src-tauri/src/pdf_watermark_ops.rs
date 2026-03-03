use image::codecs::jpeg::JpegEncoder;
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document as LopdfDocument, Object, Stream};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::PathBuf;

use crate::utils::{ensure_output_dir, file_stem};

/// Parse a hex color string (#RRGGBB or RRGGBB) into (r, g, b) floats in 0.0–1.0.
/// Falls back to light grey (0.7, 0.7, 0.7) on invalid input.
fn hex_to_rgb_f32(hex: &str) -> (f32, f32, f32) {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return (0.7, 0.7, 0.7);
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(179);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(179);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(179);
    (r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfWatermarkResult {
    pub output_path: String,
    pub page_count: usize,
    pub errors: Vec<String>,
}

/// Watermark every page of a PDF with a semi-transparent text string.
/// Uses the built-in PDF font Helvetica-Bold (no system font needed).
#[allow(clippy::too_many_arguments)]
pub fn watermark_pdf_text(
    pdf_path: &str,
    text: &str,
    position: &str,
    opacity: f32,
    font_size: f32,
    color: &str,
    output_dir: &str,
) -> PdfWatermarkResult {
    let mut result = PdfWatermarkResult {
        output_path: String::new(),
        page_count: 0,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let mut doc = match LopdfDocument::load(pdf_path) {
        Ok(d) => d,
        Err(e) => {
            result.errors.push(format!("Cannot load PDF: {}", e));
            return result;
        }
    };

    let opacity_clamped = opacity.clamp(0.0, 1.0);

    // Create a shared ExtGState for transparency
    let gs_dict = dictionary! {
        "Type" => "ExtGState",
        "ca" => opacity_clamped as f64,
        "CA" => opacity_clamped as f64
    };
    let gs_id = doc.add_object(Object::Dictionary(gs_dict));

    // Create a shared font reference (Helvetica-Bold, built-in PDF font)
    let font_dict = dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica-Bold"
    };
    let font_id = doc.add_object(Object::Dictionary(font_dict));

    // Collect page IDs first to avoid borrow issues
    let page_ids: Vec<lopdf::ObjectId> = doc.page_iter().collect();

    for &page_id in &page_ids {
        // Read page dimensions from MediaBox
        let (page_w, page_h) = get_page_dimensions(&doc, page_id);

        // Approximate text width (Helvetica-Bold is roughly 0.6 × font_size per char)
        let char_width_factor = 0.6;
        let text_width = font_size * text.len() as f32 * char_width_factor;
        let text_height = font_size;

        // Build the content stream operations for the watermark
        let (cr, cg, cb) = hex_to_rgb_f32(color);
        let operations = build_text_watermark_ops(
            text,
            position,
            font_size,
            text_width,
            text_height,
            page_w,
            page_h,
            cr,
            cg,
            cb,
        );

        let content_ops = Content { operations };
        let content_bytes = match content_ops.encode() {
            Ok(b) => b,
            Err(e) => {
                result
                    .errors
                    .push(format!("Content encode error on page: {}", e));
                continue;
            }
        };

        let content_stream = Stream::new(dictionary! {}, content_bytes);
        let content_id = doc.add_object(Object::Stream(content_stream));

        // Inject watermark resources into the page (handles indirect refs)
        let entries = vec![("ExtGState", "WmGs", gs_id), ("Font", "WmF1", font_id)];
        inject_page_resources(&mut doc, page_id, &entries);

        // Append watermark content stream
        if let Ok(&mut Object::Dictionary(ref mut page_dict)) = doc.get_object_mut(page_id) {
            append_content_to_page(page_dict, content_id);
            result.page_count += 1;
        }
    }

    let pdf_stem = file_stem(pdf_path);
    let output_path = out_dir.join(format!("{}-watermarked.pdf", pdf_stem));

    match doc.save(&output_path) {
        Ok(_) => {
            result.output_path = output_path.to_string_lossy().to_string();
        }
        Err(e) => {
            result
                .errors
                .push(format!("Cannot save watermarked PDF: {}", e));
            result.page_count = 0;
        }
    }

    result
}

/// Watermark every page of a PDF with a semi-transparent image/logo overlay.
#[allow(clippy::too_many_arguments)]
pub fn watermark_pdf_image(
    pdf_path: &str,
    image_path: &str,
    position: &str,
    opacity: f32,
    scale: f32,
    output_dir: &str,
) -> PdfWatermarkResult {
    let mut result = PdfWatermarkResult {
        output_path: String::new(),
        page_count: 0,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let mut doc = match LopdfDocument::load(pdf_path) {
        Ok(d) => d,
        Err(e) => {
            result.errors.push(format!("Cannot load PDF: {}", e));
            return result;
        }
    };

    // Load the watermark image (keep alpha channel for transparency)
    let img_rgba = match image::open(image_path) {
        Ok(i) => i.into_rgba8(),
        Err(e) => {
            result.errors.push(format!(
                "Cannot load watermark image '{}': {}",
                image_path, e
            ));
            return result;
        }
    };
    let (img_w, img_h) = (img_rgba.width(), img_rgba.height());
    if img_w == 0 || img_h == 0 {
        result
            .errors
            .push("Watermark image has zero dimensions".to_string());
        return result;
    }

    // Separate RGB and Alpha channels
    let mut rgb_pixels: Vec<u8> = Vec::with_capacity((img_w * img_h * 3) as usize);
    let mut alpha_pixels: Vec<u8> = Vec::with_capacity((img_w * img_h) as usize);
    let mut has_transparency = false;
    for pixel in img_rgba.pixels() {
        rgb_pixels.extend_from_slice(&[pixel[0], pixel[1], pixel[2]]);
        alpha_pixels.push(pixel[3]);
        if pixel[3] < 255 {
            has_transparency = true;
        }
    }

    // JPEG-encode the RGB data
    let rgb_image: image::RgbImage = image::RgbImage::from_raw(img_w, img_h, rgb_pixels)
        .unwrap_or_else(|| image::RgbImage::new(img_w, img_h));
    let mut jpeg_buf: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_buf);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, 90);
    if let Err(e) = rgb_image.write_with_encoder(encoder) {
        result
            .errors
            .push(format!("Cannot encode watermark image: {}", e));
        return result;
    }

    let opacity_clamped = opacity.clamp(0.0, 1.0);

    // Create shared ExtGState for transparency
    let gs_dict = dictionary! {
        "Type" => "ExtGState",
        "ca" => opacity_clamped as f64,
        "CA" => opacity_clamped as f64
    };
    let gs_id = doc.add_object(Object::Dictionary(gs_dict));

    // If the image has transparency, create an SMask (soft mask) XObject
    let smask_obj_id = if has_transparency {
        let mut smask_stream = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => img_w as i64,
                "Height" => img_h as i64,
                "ColorSpace" => "DeviceGray",
                "BitsPerComponent" => 8_i64
            },
            alpha_pixels,
        );
        smask_stream.allows_compression = true;
        Some(doc.add_object(Object::Stream(smask_stream)))
    } else {
        None
    };

    // Create the image XObject (disable compression — data is already JPEG-encoded)
    let mut image_dict = dictionary! {
        "Type" => "XObject",
        "Subtype" => "Image",
        "Width" => img_w as i64,
        "Height" => img_h as i64,
        "ColorSpace" => "DeviceRGB",
        "BitsPerComponent" => 8_i64,
        "Filter" => "DCTDecode"
    };
    if let Some(smask_id) = smask_obj_id {
        image_dict.set("SMask", Object::Reference(smask_id));
    }
    let mut image_stream = Stream::new(image_dict, jpeg_buf);
    image_stream.allows_compression = false;
    let image_obj_id = doc.add_object(Object::Stream(image_stream));

    let scale_clamped = scale.clamp(0.01, 1.0);
    let aspect_ratio = img_h as f32 / img_w as f32;

    // Collect page IDs
    let page_ids: Vec<lopdf::ObjectId> = doc.page_iter().collect();

    for &page_id in &page_ids {
        let (page_w, page_h) = get_page_dimensions(&doc, page_id);

        // Compute watermark draw dimensions
        let draw_w = page_w * scale_clamped;
        let draw_h = draw_w * aspect_ratio;
        let margin = 20.0_f32;

        let operations =
            build_image_watermark_ops(position, draw_w, draw_h, page_w, page_h, margin);

        let content_ops = Content { operations };
        let content_bytes = match content_ops.encode() {
            Ok(b) => b,
            Err(e) => {
                result
                    .errors
                    .push(format!("Content encode error on page: {}", e));
                continue;
            }
        };

        let content_stream = Stream::new(dictionary! {}, content_bytes);
        let content_id = doc.add_object(Object::Stream(content_stream));

        // Inject watermark resources into the page (handles indirect refs)
        let entries = vec![
            ("ExtGState", "WmGs", gs_id),
            ("XObject", "WmImg", image_obj_id),
        ];
        inject_page_resources(&mut doc, page_id, &entries);

        // Append watermark content stream
        if let Ok(&mut Object::Dictionary(ref mut page_dict)) = doc.get_object_mut(page_id) {
            append_content_to_page(page_dict, content_id);
            result.page_count += 1;
        }
    }

    let pdf_stem = file_stem(pdf_path);
    let output_path = out_dir.join(format!("{}-watermarked.pdf", pdf_stem));

    match doc.save(&output_path) {
        Ok(_) => {
            result.output_path = output_path.to_string_lossy().to_string();
        }
        Err(e) => {
            result
                .errors
                .push(format!("Cannot save watermarked PDF: {}", e));
            result.page_count = 0;
        }
    }

    result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Read page MediaBox dimensions, defaulting to A4 (595×842) if missing.
fn get_page_dimensions(doc: &LopdfDocument, page_id: lopdf::ObjectId) -> (f32, f32) {
    let default = (595.0_f32, 842.0_f32);
    let page_obj = match doc.get_object(page_id) {
        Ok(o) => o,
        Err(_) => return default,
    };
    let dict = match page_obj {
        Object::Dictionary(d) => d,
        _ => return default,
    };
    let media_box = match dict.get(b"MediaBox") {
        Ok(Object::Array(arr)) => arr,
        _ => return default,
    };
    if media_box.len() < 4 {
        return default;
    }
    let w = obj_to_f32(&media_box[2]).unwrap_or(default.0);
    let h = obj_to_f32(&media_box[3]).unwrap_or(default.1);
    (w, h)
}

fn obj_to_f32(obj: &Object) -> Option<f32> {
    match obj {
        Object::Integer(i) => Some(*i as f32),
        Object::Real(f) => Some(*f),
        _ => None,
    }
}

/// Inject resource entries into a page's Resources dictionary.
/// Properly handles indirect (Reference) Resources AND indirect sub-category dicts
/// (e.g. Font, ExtGState, XObject that are stored as references).
fn inject_page_resources(
    doc: &mut LopdfDocument,
    page_id: lopdf::ObjectId,
    entries: &[(&str, &str, lopdf::ObjectId)],
) {
    // Step 1 (read-only): Determine if Resources is an indirect reference
    let resources_ref_id: Option<lopdf::ObjectId> = doc.get_object(page_id).ok().and_then(|obj| {
        if let Object::Dictionary(d) = obj {
            if let Ok(Object::Reference(ref_id)) = d.get(b"Resources") {
                return Some(*ref_id);
            }
        }
        None
    });

    // Step 2 (read-only): For each entry, check if the sub-category dict (Font, XObject…)
    // is itself an indirect reference inside the Resources dict.
    let sub_category_refs: Vec<Option<lopdf::ObjectId>> = {
        let res_dict_opt: Option<&lopdf::Dictionary> = if let Some(rid) = resources_ref_id {
            match doc.get_object(rid) {
                Ok(Object::Dictionary(d)) => Some(d),
                _ => None,
            }
        } else {
            match doc.get_object(page_id) {
                Ok(Object::Dictionary(page_d)) => match page_d.get(b"Resources") {
                    Ok(Object::Dictionary(d)) => Some(d),
                    _ => None,
                },
                _ => None,
            }
        };

        entries
            .iter()
            .map(|&(category, _, _)| {
                res_dict_opt.and_then(|d| {
                    if let Ok(Object::Reference(ref_id)) = d.get(category.as_bytes()) {
                        Some(*ref_id)
                    } else {
                        None
                    }
                })
            })
            .collect()
    };

    // Step 3 (mutable): For entries whose sub-category IS an indirect ref, modify the ref'd dict
    for (i, &(_, name, obj_id)) in entries.iter().enumerate() {
        if let Some(sub_id) = sub_category_refs[i] {
            if let Ok(&mut Object::Dictionary(ref mut sub_dict)) = doc.get_object_mut(sub_id) {
                sub_dict.set(name, Object::Reference(obj_id));
            }
        }
    }

    // Step 4 (mutable): For entries whose sub-category is inline or missing, handle normally
    let remaining_entries: Vec<(&str, &str, lopdf::ObjectId)> = entries
        .iter()
        .enumerate()
        .filter(|(i, _)| sub_category_refs[*i].is_none())
        .map(|(_, e)| *e)
        .collect();

    if remaining_entries.is_empty() {
        return;
    }

    if let Some(res_id) = resources_ref_id {
        if let Ok(&mut Object::Dictionary(ref mut res_dict)) = doc.get_object_mut(res_id) {
            add_entries_to_resources(res_dict, &remaining_entries);
        }
    } else if let Ok(&mut Object::Dictionary(ref mut page_dict)) = doc.get_object_mut(page_id) {
        if let Ok(Object::Dictionary(ref mut res_dict)) = page_dict.get_mut(b"Resources") {
            add_entries_to_resources(res_dict, &remaining_entries);
        } else {
            let mut new_res = lopdf::Dictionary::new();
            add_entries_to_resources(&mut new_res, &remaining_entries);
            page_dict.set("Resources", Object::Dictionary(new_res));
        }
    }
}

/// Add resource entries (category/name/object_id) to a Resources dictionary,
/// merging into existing inline sub-dictionaries when present.
/// NOTE: Only called for sub-categories that are NOT indirect references
/// (those are handled directly in inject_page_resources).
fn add_entries_to_resources(
    res_dict: &mut lopdf::Dictionary,
    entries: &[(&str, &str, lopdf::ObjectId)],
) {
    for &(category, name, obj_id) in entries {
        if let Ok(Object::Dictionary(ref mut sub)) = res_dict.get_mut(category.as_bytes()) {
            sub.set(name, Object::Reference(obj_id));
        } else {
            res_dict.set(category, Object::Dictionary(dictionary! { name => obj_id }));
        }
    }
}

/// Append a content stream reference to a page's Contents entry.
/// Handles both single-reference and array Contents.
fn append_content_to_page(page_dict: &mut lopdf::Dictionary, new_content_id: lopdf::ObjectId) {
    match page_dict.get(b"Contents") {
        Ok(Object::Reference(existing_id)) => {
            let existing_id = *existing_id;
            page_dict.set(
                "Contents",
                Object::Array(vec![
                    Object::Reference(existing_id),
                    Object::Reference(new_content_id),
                ]),
            );
        }
        Ok(Object::Array(existing_arr)) => {
            let mut new_arr = existing_arr.clone();
            new_arr.push(Object::Reference(new_content_id));
            page_dict.set("Contents", Object::Array(new_arr));
        }
        _ => {
            page_dict.set("Contents", Object::Reference(new_content_id));
        }
    }
}

/// Build PDF content stream operations for a text watermark at the given position.
#[allow(clippy::too_many_arguments)]
fn build_text_watermark_ops(
    text: &str,
    position: &str,
    font_size: f32,
    text_width: f32,
    text_height: f32,
    page_w: f32,
    page_h: f32,
    color_r: f32,
    color_g: f32,
    color_b: f32,
) -> Vec<Operation> {
    let margin = 20.0_f32;

    // For diagonal mode: rotate 45° across the page center
    if position == "diagonal" {
        let cx = page_w / 2.0;
        let cy = page_h / 2.0;
        let angle: f32 = std::f32::consts::FRAC_PI_4; // 45 degrees
        let cos_a = angle.cos();
        let sin_a = angle.sin();
        // Translate so text is centered at page center
        let tx = cx - (text_width * cos_a - text_height * sin_a) / 2.0;
        let ty = cy - (text_width * sin_a + text_height * cos_a) / 2.0;

        return vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(b"WmGs".to_vec())]),
            Operation::new("BT", vec![]),
            Operation::new(
                "Tf",
                vec![Object::Name(b"WmF1".to_vec()), Object::Real(font_size)],
            ),
            Operation::new(
                "Tm",
                vec![
                    Object::Real(cos_a),
                    Object::Real(sin_a),
                    Object::Real(-sin_a),
                    Object::Real(cos_a),
                    Object::Real(tx),
                    Object::Real(ty),
                ],
            ),
            Operation::new(
                "rg",
                vec![
                    Object::Real(color_r),
                    Object::Real(color_g),
                    Object::Real(color_b),
                ],
            ),
            Operation::new(
                "Tj",
                vec![Object::String(
                    text.as_bytes().to_vec(),
                    lopdf::StringFormat::Literal,
                )],
            ),
            Operation::new("ET", vec![]),
            Operation::new("Q", vec![]),
        ];
    }

    // For tiled mode: repeat text across the page
    if position == "tiled" {
        let mut ops = vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(b"WmGs".to_vec())]),
            Operation::new("BT", vec![]),
            Operation::new(
                "Tf",
                vec![Object::Name(b"WmF1".to_vec()), Object::Real(font_size)],
            ),
            Operation::new(
                "rg",
                vec![
                    Object::Real(color_r),
                    Object::Real(color_g),
                    Object::Real(color_b),
                ],
            ),
        ];

        let step_x = text_width + 80.0;
        let step_y = text_height + 80.0;
        let mut y = margin;
        while y < page_h {
            let mut x = margin;
            while x < page_w {
                ops.push(Operation::new(
                    "Td",
                    vec![
                        Object::Real(if x == margin && y == margin { x } else { 0.0 }),
                        Object::Real(0.0),
                    ],
                ));
                // Use Tm for absolute positioning
                ops.push(Operation::new(
                    "Tm",
                    vec![
                        Object::Real(1.0),
                        Object::Integer(0),
                        Object::Integer(0),
                        Object::Real(1.0),
                        Object::Real(x),
                        Object::Real(y),
                    ],
                ));
                ops.push(Operation::new(
                    "Tj",
                    vec![Object::String(
                        text.as_bytes().to_vec(),
                        lopdf::StringFormat::Literal,
                    )],
                ));
                x += step_x;
            }
            y += step_y;
        }

        ops.push(Operation::new("ET", vec![]));
        ops.push(Operation::new("Q", vec![]));
        return ops;
    }

    // Single-position modes
    let (x, y) = match position {
        "top-left" => (margin, page_h - margin - text_height),
        "top-right" => (page_w - text_width - margin, page_h - margin - text_height),
        "bottom-left" => (margin, margin),
        "bottom-right" => (page_w - text_width - margin, margin),
        // "center" and fallback
        _ => ((page_w - text_width) / 2.0, (page_h - text_height) / 2.0),
    };

    vec![
        Operation::new("q", vec![]),
        Operation::new("gs", vec![Object::Name(b"WmGs".to_vec())]),
        Operation::new("BT", vec![]),
        Operation::new(
            "Tf",
            vec![Object::Name(b"WmF1".to_vec()), Object::Real(font_size)],
        ),
        Operation::new(
            "rg",
            vec![
                Object::Real(color_r),
                Object::Real(color_g),
                Object::Real(color_b),
            ],
        ),
        Operation::new("Td", vec![Object::Real(x), Object::Real(y)]),
        Operation::new(
            "Tj",
            vec![Object::String(
                text.as_bytes().to_vec(),
                lopdf::StringFormat::Literal,
            )],
        ),
        Operation::new("ET", vec![]),
        Operation::new("Q", vec![]),
    ]
}

/// Build PDF content stream operations for an image watermark at the given position.
fn build_image_watermark_ops(
    position: &str,
    draw_w: f32,
    draw_h: f32,
    page_w: f32,
    page_h: f32,
    margin: f32,
) -> Vec<Operation> {
    if position == "tiled" {
        let step_x = draw_w + 40.0;
        let step_y = draw_h + 40.0;
        let mut ops = vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(b"WmGs".to_vec())]),
        ];

        let mut y = margin;
        while y < page_h {
            let mut x = margin;
            while x < page_w {
                ops.push(Operation::new("q", vec![]));
                ops.push(Operation::new(
                    "cm",
                    vec![
                        Object::Real(draw_w),
                        Object::Integer(0),
                        Object::Integer(0),
                        Object::Real(draw_h),
                        Object::Real(x),
                        Object::Real(y),
                    ],
                ));
                ops.push(Operation::new("Do", vec![Object::Name(b"WmImg".to_vec())]));
                ops.push(Operation::new("Q", vec![]));
                x += step_x;
            }
            y += step_y;
        }

        ops.push(Operation::new("Q", vec![]));
        return ops;
    }

    // Single-position modes
    let (x, y) = match position {
        "top-left" => (margin, page_h - margin - draw_h),
        "top-right" => (page_w - draw_w - margin, page_h - margin - draw_h),
        "bottom-left" => (margin, margin),
        "bottom-right" => (page_w - draw_w - margin, margin),
        // "center", "diagonal", and fallback
        _ => ((page_w - draw_w) / 2.0, (page_h - draw_h) / 2.0),
    };

    vec![
        Operation::new("q", vec![]),
        Operation::new("gs", vec![Object::Name(b"WmGs".to_vec())]),
        Operation::new(
            "cm",
            vec![
                Object::Real(draw_w),
                Object::Integer(0),
                Object::Integer(0),
                Object::Real(draw_h),
                Object::Real(x),
                Object::Real(y),
            ],
        ),
        Operation::new("Do", vec![Object::Name(b"WmImg".to_vec())]),
        Operation::new("Q", vec![]),
    ]
}
