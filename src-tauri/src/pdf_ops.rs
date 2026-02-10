use pdfium_render::prelude::*;
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
