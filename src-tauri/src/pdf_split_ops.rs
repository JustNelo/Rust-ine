use lopdf::Document as LopdfDocument;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::utils::ensure_output_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfSplitResult {
    pub output_files: Vec<String>,
    pub errors: Vec<String>,
}

/// Parse a range string like "1-3, 4-10, 11-end" into Vec<(start, end)> pairs.
/// Page numbers are 1-indexed. "end" means the last page.
fn parse_ranges(ranges_str: &str, total_pages: u32) -> Result<Vec<(u32, u32)>, String> {
    let mut result = Vec::new();

    for part in ranges_str.split(',') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Some(dash_pos) = trimmed.find('-') {
            let start_str = trimmed[..dash_pos].trim();
            let end_str = trimmed[dash_pos + 1..].trim();

            let start: u32 = start_str
                .parse()
                .map_err(|_| format!("Invalid start page: '{}'", start_str))?;

            let end: u32 = if end_str.eq_ignore_ascii_case("end") || end_str.eq_ignore_ascii_case("fin") {
                total_pages
            } else {
                end_str
                    .parse()
                    .map_err(|_| format!("Invalid end page: '{}'", end_str))?
            };

            if start == 0 || end == 0 {
                return Err("Page numbers must be >= 1".to_string());
            }
            if start > end {
                return Err(format!("Invalid range: {}-{} (start > end)", start, end));
            }
            if end > total_pages {
                return Err(format!(
                    "Page {} exceeds total pages ({})",
                    end, total_pages
                ));
            }

            result.push((start, end));
        } else {
            // Single page number
            let page: u32 = trimmed
                .parse()
                .map_err(|_| format!("Invalid page number: '{}'", trimmed))?;

            if page == 0 || page > total_pages {
                return Err(format!(
                    "Page {} is out of range (1-{})",
                    page, total_pages
                ));
            }
            result.push((page, page));
        }
    }

    if result.is_empty() {
        return Err("No valid page ranges provided".to_string());
    }

    Ok(result)
}

pub fn split_pdf(
    pdf_path: &str,
    ranges_str: &str,
    output_dir: &str,
) -> PdfSplitResult {
    let mut result = PdfSplitResult {
        output_files: Vec::new(),
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let source_doc = match LopdfDocument::load(pdf_path) {
        Ok(d) => d,
        Err(e) => {
            result
                .errors
                .push(format!("Cannot load PDF '{}': {}", pdf_path, e));
            return result;
        }
    };

    let total_pages = source_doc.get_pages().len() as u32;

    let ranges = match parse_ranges(ranges_str, total_pages) {
        Ok(r) => r,
        Err(e) => {
            result.errors.push(e);
            return result;
        }
    };

    let pdf_stem = Path::new(pdf_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("pdf");

    for (_range_index, (start, end)) in ranges.iter().enumerate() {
        let pages_to_extract: Vec<u32> = (*start..=*end).collect();

        let mut new_doc = source_doc.clone();

        // Collect all page numbers in the source document
        let all_pages: Vec<u32> = new_doc.get_pages().keys().copied().collect();

        // Delete pages that are NOT in the desired range
        let mut pages_to_delete: Vec<u32> = all_pages
            .into_iter()
            .filter(|p| !pages_to_extract.contains(p))
            .collect();

        // Delete from highest to lowest to avoid index shifting
        pages_to_delete.sort_unstable();
        pages_to_delete.reverse();

        for page_num in pages_to_delete {
            new_doc.delete_pages(&[page_num]);
        }

        let output_filename = if *start == *end {
            format!("{}_page_{}.pdf", pdf_stem, start)
        } else {
            format!("{}_pages_{}-{}.pdf", pdf_stem, start, end)
        };
        let output_path = out_dir.join(&output_filename);

        match new_doc.save(&output_path) {
            Ok(_) => {
                result
                    .output_files
                    .push(output_path.to_string_lossy().to_string());
            }
            Err(e) => {
                result.errors.push(format!(
                    "Range {}-{}: failed to save — {}",
                    start, end, e
                ));
            }
        }
    }

    result
}
