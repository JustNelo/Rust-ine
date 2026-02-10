use image::ImageFormat;
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document as LopdfDocument, Object, Stream};
use pdfium_render::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfExtractionResult {
    pub pdf_path: String,
    pub output_dir: String,
    pub extracted_count: usize,
    pub errors: Vec<String>,
}

fn ensure_output_dir(out_dir: &Path) -> Result<(), String> {
    if !out_dir.exists() {
        fs::create_dir_all(out_dir)
            .map_err(|e| format!("Cannot create output directory: {}", e))?;
    }
    Ok(())
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
        let img = match image::open(input_path) {
            Ok(i) => i.into_rgb8(),
            Err(e) => {
                let filename = Path::new(input_path)
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or(input_path);
                result.errors.push(format!("{}: {}", filename, e));
                continue;
            }
        };

        let (width, height) = (img.width(), img.height());

        let mut jpeg_buf: Vec<u8> = Vec::new();
        if let Err(e) = img.write_to(&mut Cursor::new(&mut jpeg_buf), ImageFormat::Jpeg) {
            let filename = Path::new(input_path)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or(input_path);
            result.errors.push(format!("{}: JPEG encode failed — {}", filename, e));
            continue;
        }

        let image_stream = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => width as i64,
                "Height" => height as i64,
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
                        Object::Real(width as f32),
                        Object::Integer(0),
                        Object::Integer(0),
                        Object::Real(height as f32),
                        Object::Integer(0),
                        Object::Integer(0),
                    ],
                ),
                Operation::new("Do", vec![Object::Name(b"Img0".to_vec())]),
                Operation::new("Q", vec![]),
            ],
        };

        let content_bytes = match content_ops.encode() {
            Ok(b) => b,
            Err(e) => {
                result.errors.push(format!("Content encode error: {}", e));
                continue;
            }
        };

        let content_stream = Stream::new(dictionary! {}, content_bytes);
        let content_id = doc.add_object(content_stream);

        let page = dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Real(width as f32),
                Object::Real(height as f32),
            ],
            "Resources" => dictionary! {
                "XObject" => dictionary! {
                    "Img0" => image_id
                }
            },
            "Contents" => content_id
        };
        let page_id = doc.add_object(page);
        page_ids.push(Object::Reference(page_id));
        result.page_count += 1;
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
