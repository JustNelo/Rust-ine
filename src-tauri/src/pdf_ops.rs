use lopdf::{dictionary, Document as LopdfDocument, Object};
use pdfium_render::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::utils::{ensure_output_dir, embed_image_as_pdf_page, filename_or_default};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfExtractionResult {
    pub pdf_path: String,
    pub output_dir: String,
    pub extracted_count: usize,
    pub errors: Vec<String>,
}

pub fn extract_images_from_pdf(
    pdf_path: &str,
    output_dir: &str,
    pdfium_lib_path: &str,
) -> PdfExtractionResult {
    let mut result = PdfExtractionResult {
        pdf_path: pdf_path.to_string(),
        output_dir: output_dir.to_string(),
        extracted_count: 0,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let bindings = match Pdfium::bind_to_library(pdfium_lib_path) {
        Ok(b) => b,
        Err(e) => {
            result
                .errors
                .push(format!("Cannot load Pdfium library: {}", e));
            return result;
        }
    };
    let pdfium = Pdfium::new(bindings);

    let document = match pdfium.load_pdf_from_file(pdf_path, None) {
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

    for (page_index, page) in document.pages().iter().enumerate() {
        for object in page.objects().iter() {
            if let Some(image_object) = object.as_image_object() {
                image_index += 1;

                match image_object.get_raw_image() {
                    Ok(dynamic_image) => {
                        let out_path =
                            out_dir.join(format!("{}_{}.png", pdf_stem, image_index));
                        match dynamic_image.into_rgb8().save(&out_path) {
                            Ok(_) => result.extracted_count += 1,
                            Err(e) => result.errors.push(format!(
                                "Page {}, image {}: failed to save — {}",
                                page_index + 1,
                                image_index,
                                e
                            )),
                        }
                    }
                    Err(e) => {
                        result.errors.push(format!(
                            "Page {}, image {}: failed to extract — {}",
                            page_index + 1,
                            image_index,
                            e
                        ));
                    }
                }
            }
        }
    }

    result
}

// --- Images to PDF ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImagesToPdfResult {
    pub output_path: String,
    pub page_count: usize,
    pub errors: Vec<String>,
}

pub fn images_to_pdf(
    input_paths: Vec<String>,
    output_path: &str,
) -> ImagesToPdfResult {
    let mut result = ImagesToPdfResult {
        output_path: output_path.to_string(),
        page_count: 0,
        errors: Vec::new(),
    };

    let mut doc = LopdfDocument::with_version("1.7");
    let pages_id = doc.new_object_id();
    let mut page_ids: Vec<Object> = Vec::new();

    for input_path in &input_paths {
        // Use fit-to-image dimensions: read image to get size first
        let img = match image::open(input_path) {
            Ok(i) => i,
            Err(e) => {
                result.errors.push(format!("{}: {}", filename_or_default(input_path), e));
                continue;
            }
        };
        let (width, height) = (img.width() as f32, img.height() as f32);
        drop(img);

        match embed_image_as_pdf_page(&mut doc, pages_id, input_path, width, height, 0.0, 85) {
            Ok(page_id) => {
                page_ids.push(Object::Reference(page_id));
                result.page_count += 1;
            }
            Err(e) => {
                result.errors.push(format!("{}: {}", filename_or_default(input_path), e));
            }
        }
    }

    if result.page_count == 0 {
        result.errors.push("No images could be added to the PDF".to_string());
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

    if let Err(e) = doc.save(output_path) {
        result.errors.push(format!("Cannot save PDF: {}", e));
        result.page_count = 0;
    }

    result
}

// --- PDF to Images ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfToImagesResult {
    pub pdf_path: String,
    pub output_dir: String,
    pub exported_count: usize,
    pub errors: Vec<String>,
}

pub fn pdf_to_images(
    pdf_path: &str,
    output_dir: &str,
    pdfium_lib_path: &str,
    format: &str,
    dpi: u32,
) -> PdfToImagesResult {
    let mut result = PdfToImagesResult {
        pdf_path: pdf_path.to_string(),
        output_dir: output_dir.to_string(),
        exported_count: 0,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let bindings = match Pdfium::bind_to_library(pdfium_lib_path) {
        Ok(b) => b,
        Err(e) => {
            result.errors.push(format!("Cannot load Pdfium library: {}", e));
            return result;
        }
    };
    let pdfium = Pdfium::new(bindings);

    let document = match pdfium.load_pdf_from_file(pdf_path, None) {
        Ok(d) => d,
        Err(e) => {
            result.errors.push(format!("Cannot open PDF '{}': {}", pdf_path, e));
            return result;
        }
    };

    let pdf_stem = Path::new(pdf_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("pdf");

    // Scale factor: pdfium renders at 72 DPI by default
    let scale = dpi as f32 / 72.0;

    for (page_index, page) in document.pages().iter().enumerate() {
        let page_w = page.width().value * scale;
        let page_h = page.height().value * scale;

        let render_config = PdfRenderConfig::new()
            .set_target_width(page_w as i32)
            .set_maximum_height(page_h as i32);

        match page.render_with_config(&render_config) {
            Ok(bitmap) => {
                let dynamic_image = bitmap.as_image();
                let ext = if format == "jpg" { "jpg" } else { "png" };
                let out_path = out_dir.join(format!("{}_page_{}.{}", pdf_stem, page_index + 1, ext));

                let save_result = if format == "jpg" {
                    dynamic_image.to_rgb8().save(&out_path)
                } else {
                    dynamic_image.save(&out_path)
                };

                match save_result {
                    Ok(_) => result.exported_count += 1,
                    Err(e) => result.errors.push(format!(
                        "Page {}: failed to save — {}",
                        page_index + 1,
                        e
                    )),
                }
            }
            Err(e) => {
                result.errors.push(format!(
                    "Page {}: render failed — {}",
                    page_index + 1,
                    e
                ));
            }
        }
    }

    result
}
