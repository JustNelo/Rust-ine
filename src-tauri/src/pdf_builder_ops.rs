use image::codecs::jpeg::JpegEncoder;
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document as LopdfDocument, Object, Stream};
use pdfium_render::prelude::*;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::Path;

// --- Structs ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PageThumbnail {
    pub id: String,
    pub source_path: String,
    pub page_number: usize,
    pub thumbnail_b64: String,
    pub source_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfBuilderItem {
    pub source_path: String,
    pub page_number: Option<usize>,
    pub source_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergePdfOptions {
    pub page_format: String,
    pub orientation: String,
    pub margin_px: u32,
    pub image_quality: u32,
    pub output_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergePdfResult {
    pub output_path: String,
    pub page_count: usize,
    pub errors: Vec<String>,
}

// --- Thumbnail generation ---

fn encode_image_to_b64_jpeg(img: &image::DynamicImage, max_width: u32) -> Result<String, String> {
    let resized = if img.width() > max_width {
        img.resize(max_width, max_width * 2, image::imageops::FilterType::Triangle)
    } else {
        img.clone()
    };

    let mut jpeg_buf: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_buf);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, 70);
    resized
        .write_with_encoder(encoder)
        .map_err(|e| format!("JPEG encode failed: {}", e))?;

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&jpeg_buf))
}

pub fn generate_image_thumbnail(path: &str) -> Result<PageThumbnail, String> {
    let img = image::open(path).map_err(|e| format!("Cannot open image '{}': {}", path, e))?;
    let b64 = encode_image_to_b64_jpeg(&img, 200)?;
    let filename = Path::new(path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("image");

    Ok(PageThumbnail {
        id: format!("img_{}_{}", filename, 0),
        source_path: path.to_string(),
        page_number: 0,
        thumbnail_b64: b64,
        source_type: "image".to_string(),
    })
}

pub fn generate_pdf_page_thumbnails(
    pdf_path: &str,
    pdfium_lib_path: &str,
) -> Result<Vec<PageThumbnail>, String> {
    let bindings = Pdfium::bind_to_library(pdfium_lib_path)
        .map_err(|e| format!("Cannot load Pdfium library: {}", e))?;
    let pdfium = Pdfium::new(bindings);

    let document = pdfium
        .load_pdf_from_file(pdf_path, None)
        .map_err(|e| format!("Cannot open PDF '{}': {}", pdf_path, e))?;

    let pdf_stem = Path::new(pdf_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("pdf");

    let page_count = document.pages().len();
    let mut thumbnails: Vec<PageThumbnail> = Vec::with_capacity(page_count as usize);

    for (page_index, page) in document.pages().iter().enumerate() {
        let render_result = page.render_with_config(
            &PdfRenderConfig::new()
                .set_target_width(200)
                .set_maximum_height(400),
        );

        match render_result {
            Ok(bitmap) => {
                let dynamic_image = bitmap.as_image();
                match encode_image_to_b64_jpeg(&dynamic_image, 200) {
                    Ok(b64) => {
                        thumbnails.push(PageThumbnail {
                            id: format!("pdf_{}_p{}", pdf_stem, page_index + 1),
                            source_path: pdf_path.to_string(),
                            page_number: page_index + 1,
                            thumbnail_b64: b64,
                            source_type: "pdf".to_string(),
                        });
                    }
                    Err(e) => {
                        thumbnails.push(PageThumbnail {
                            id: format!("pdf_{}_p{}", pdf_stem, page_index + 1),
                            source_path: pdf_path.to_string(),
                            page_number: page_index + 1,
                            thumbnail_b64: String::new(),
                            source_type: "pdf".to_string(),
                        });
                        eprintln!(
                            "Warning: thumbnail encode failed for {} page {}: {}",
                            pdf_path,
                            page_index + 1,
                            e
                        );
                    }
                }
            }
            Err(e) => {
                thumbnails.push(PageThumbnail {
                    id: format!("pdf_{}_p{}", pdf_stem, page_index + 1),
                    source_path: pdf_path.to_string(),
                    page_number: page_index + 1,
                    thumbnail_b64: String::new(),
                    source_type: "pdf".to_string(),
                });
                eprintln!(
                    "Warning: render failed for {} page {}: {}",
                    pdf_path,
                    page_index + 1,
                    e
                );
            }
        }
    }

    Ok(thumbnails)
}

pub fn generate_thumbnails_batch(
    file_paths: Vec<String>,
    pdfium_lib_path: &str,
) -> Vec<PageThumbnail> {
    // Separate images and PDFs
    let mut image_paths: Vec<String> = Vec::new();
    let mut pdf_paths: Vec<String> = Vec::new();

    for path in &file_paths {
        let ext = Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "pdf" {
            pdf_paths.push(path.clone());
        } else {
            image_paths.push(path.clone());
        }
    }

    // Generate image thumbnails in parallel with rayon
    let mut all_thumbnails: Vec<PageThumbnail> = image_paths
        .par_iter()
        .filter_map(|path| generate_image_thumbnail(path).ok())
        .collect();

    // Generate PDF thumbnails sequentially (pdfium binding per call)
    for pdf_path in &pdf_paths {
        match generate_pdf_page_thumbnails(pdf_path, pdfium_lib_path) {
            Ok(thumbs) => all_thumbnails.extend(thumbs),
            Err(e) => eprintln!("Warning: PDF thumbnail generation failed for {}: {}", pdf_path, e),
        }
    }

    all_thumbnails
}

// --- PDF Merge ---

fn get_page_dimensions(format: &str, orientation: &str) -> (f32, f32) {
    let (w, h) = match format {
        "a4" => (595.28, 841.89),
        "letter" => (612.0, 792.0),
        _ => (595.28, 841.89),
    };

    if orientation == "landscape" {
        (h, w)
    } else {
        (w, h)
    }
}

fn add_image_page(
    doc: &mut LopdfDocument,
    pages_id: lopdf::ObjectId,
    image_path: &str,
    options: &MergePdfOptions,
) -> Result<lopdf::ObjectId, String> {
    let img = image::open(image_path)
        .map_err(|e| format!("Cannot open image '{}': {}", image_path, e))?
        .into_rgb8();

    let (img_w, img_h) = (img.width(), img.height());

    let quality = options.image_quality.clamp(1, 100) as u8;
    let mut jpeg_buf: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_buf);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, quality);
    img.write_with_encoder(encoder)
        .map_err(|e| format!("JPEG encode failed: {}", e))?;

    let (page_w, page_h) = if options.page_format == "fit" {
        (img_w as f32, img_h as f32)
    } else {
        get_page_dimensions(&options.page_format, &options.orientation)
    };

    let margin = options.margin_px as f32;
    let available_w = page_w - 2.0 * margin;
    let available_h = page_h - 2.0 * margin;

    // Scale image to fit within available area while preserving aspect ratio
    let scale_x = available_w / img_w as f32;
    let scale_y = available_h / img_h as f32;
    let scale = scale_x.min(scale_y).min(1.0);

    let draw_w = img_w as f32 * scale;
    let draw_h = img_h as f32 * scale;
    let draw_x = margin + (available_w - draw_w) / 2.0;
    let draw_y = margin + (available_h - draw_h) / 2.0;

    let image_stream = Stream::new(
        dictionary! {
            "Type" => "XObject",
            "Subtype" => "Image",
            "Width" => img_w as i64,
            "Height" => img_h as i64,
            "ColorSpace" => "DeviceRGB",
            "BitsPerComponent" => 8_i64,
            "Filter" => "DCTDecode"
        },
        jpeg_buf,
    );
    let image_id = doc.add_object(image_stream);

    let content_ops = Content {
        operations: vec![
            Operation::new("q", vec![]),
            Operation::new(
                "cm",
                vec![
                    Object::Real(draw_w),
                    Object::Integer(0),
                    Object::Integer(0),
                    Object::Real(draw_h),
                    Object::Real(draw_x),
                    Object::Real(draw_y),
                ],
            ),
            Operation::new("Do", vec![Object::Name(b"Img0".to_vec())]),
            Operation::new("Q", vec![]),
        ],
    };

    let content_bytes = content_ops
        .encode()
        .map_err(|e| format!("Content encode error: {}", e))?;

    let content_stream = Stream::new(dictionary! {}, content_bytes);
    let content_id = doc.add_object(content_stream);

    let page = dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "MediaBox" => vec![
            Object::Integer(0),
            Object::Integer(0),
            Object::Real(page_w),
            Object::Real(page_h),
        ],
        "Resources" => dictionary! {
            "XObject" => dictionary! {
                "Img0" => image_id
            }
        },
        "Contents" => content_id
    };

    Ok(doc.add_object(page))
}

fn copy_pdf_page(
    dest_doc: &mut LopdfDocument,
    pages_id: lopdf::ObjectId,
    source_path: &str,
    page_number: usize,
) -> Result<lopdf::ObjectId, String> {
    let source_doc = LopdfDocument::load(source_path)
        .map_err(|e| format!("Cannot load PDF '{}': {}", source_path, e))?;

    let source_pages = source_doc.get_pages();
    let page_num_u32 = page_number as u32;

    let source_page_id = source_pages
        .get(&page_num_u32)
        .ok_or_else(|| {
            format!(
                "Page {} not found in '{}' (has {} pages)",
                page_number,
                source_path,
                source_pages.len()
            )
        })?;

    // Visited map breaks circular references (Page -> Parent -> Kids -> Page)
    let mut visited: HashMap<lopdf::ObjectId, lopdf::ObjectId> = HashMap::new();

    // Clone the entire object tree for this page into the destination document
    let cloned_page_id = deep_clone_object(dest_doc, &source_doc, *source_page_id, &mut visited)?;

    // Update the Parent reference to point to our pages catalog
    if let Ok(Object::Dictionary(ref mut dict)) = dest_doc.get_object_mut(cloned_page_id) {
        dict.set("Parent", Object::Reference(pages_id));
    }

    Ok(cloned_page_id)
}

fn deep_clone_object(
    dest: &mut LopdfDocument,
    source: &LopdfDocument,
    obj_id: lopdf::ObjectId,
    visited: &mut HashMap<lopdf::ObjectId, lopdf::ObjectId>,
) -> Result<lopdf::ObjectId, String> {
    // Return cached ID if we already cloned this object (cycle breaker)
    if let Some(&existing_id) = visited.get(&obj_id) {
        return Ok(existing_id);
    }

    let obj = source
        .get_object(obj_id)
        .map_err(|e| format!("Cannot get object {:?}: {}", obj_id, e))?
        .clone();

    // Reserve an ID upfront so recursive calls can reference it
    let new_id = dest.add_object(Object::Null);
    visited.insert(obj_id, new_id);

    let cloned = clone_object_recursive(dest, source, &obj, visited)?;
    dest.objects.insert(new_id, cloned);

    Ok(new_id)
}

fn clone_object_recursive(
    dest: &mut LopdfDocument,
    source: &LopdfDocument,
    obj: &Object,
    visited: &mut HashMap<lopdf::ObjectId, lopdf::ObjectId>,
) -> Result<Object, String> {
    match obj {
        Object::Reference(ref_id) => {
            // Recursively clone the referenced object (visited map prevents cycles)
            let new_id = deep_clone_object(dest, source, *ref_id, visited)?;
            Ok(Object::Reference(new_id))
        }
        Object::Dictionary(dict) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (key, value) in dict.iter() {
                let cloned_value = clone_object_recursive(dest, source, value, visited)?;
                new_dict.set(key.clone(), cloned_value);
            }
            Ok(Object::Dictionary(new_dict))
        }
        Object::Array(arr) => {
            let mut new_arr = Vec::with_capacity(arr.len());
            for item in arr {
                new_arr.push(clone_object_recursive(dest, source, item, visited)?);
            }
            Ok(Object::Array(new_arr))
        }
        Object::Stream(stream) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (key, value) in stream.dict.iter() {
                let cloned_value = clone_object_recursive(dest, source, value, visited)?;
                new_dict.set(key.clone(), cloned_value);
            }
            let new_stream = Stream::new(new_dict, stream.content.clone());
            Ok(Object::Stream(new_stream))
        }
        // Primitive types: clone directly
        other => Ok(other.clone()),
    }
}

pub fn merge_to_pdf(items: Vec<PdfBuilderItem>, options: MergePdfOptions) -> MergePdfResult {
    let mut result = MergePdfResult {
        output_path: options.output_path.clone(),
        page_count: 0,
        errors: Vec::new(),
    };

    let mut doc = LopdfDocument::with_version("1.7");
    let pages_id = doc.new_object_id();
    let mut page_ids: Vec<Object> = Vec::new();

    for item in &items {
        match item.source_type.as_str() {
            "image" => {
                match add_image_page(&mut doc, pages_id, &item.source_path, &options) {
                    Ok(page_id) => {
                        page_ids.push(Object::Reference(page_id));
                        result.page_count += 1;
                    }
                    Err(e) => {
                        let filename = Path::new(&item.source_path)
                            .file_name()
                            .and_then(|f| f.to_str())
                            .unwrap_or(&item.source_path);
                        result.errors.push(format!("{}: {}", filename, e));
                    }
                }
            }
            "pdf" => {
                let page_num = item.page_number.unwrap_or(1);
                match copy_pdf_page(&mut doc, pages_id, &item.source_path, page_num) {
                    Ok(page_id) => {
                        page_ids.push(Object::Reference(page_id));
                        result.page_count += 1;
                    }
                    Err(e) => {
                        let filename = Path::new(&item.source_path)
                            .file_name()
                            .and_then(|f| f.to_str())
                            .unwrap_or(&item.source_path);
                        result
                            .errors
                            .push(format!("{} (page {}): {}", filename, page_num, e));
                    }
                }
            }
            other => {
                result
                    .errors
                    .push(format!("Unknown source type: {}", other));
            }
        }
    }

    if result.page_count == 0 {
        result
            .errors
            .push("No pages could be added to the PDF".to_string());
        return result;
    }

    let pages = dictionary! {
        "Type" => "Pages",
        "Kids" => page_ids,
        "Count" => result.page_count as i64
    };
    doc.objects.insert(pages_id, Object::Dictionary(pages));

    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id
    });
    doc.trailer.set("Root", Object::Reference(catalog_id));

    if let Err(e) = doc.save(&options.output_path) {
        result.errors.push(format!("Cannot save PDF: {}", e));
        result.page_count = 0;
    }

    result
}
