use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use time::OffsetDateTime;

use crate::utils::ensure_output_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameResult {
    pub renamed_count: usize,
    pub results: Vec<RenameEntry>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameEntry {
    pub original_name: String,
    pub new_name: String,
}

/// Bulk rename files using a pattern.
/// Supported tokens: {name} (original stem), {index} (counter), {date} (YYYY-MM-DD), {ext} (extension).
/// Files are copied (not moved) to the output directory with the new name.
pub fn bulk_rename(
    input_paths: &[String],
    pattern: &str,
    start_index: u32,
    output_dir: &str,
) -> RenameResult {
    let mut result = RenameResult {
        renamed_count: 0,
        results: Vec::new(),
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let today = today_date();

    for (i, input_path) in input_paths.iter().enumerate() {
        let path = Path::new(input_path);
        let original_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        let index = start_index + i as u32;

        let new_stem = pattern
            .replace("{name}", original_stem)
            .replace("{index}", &format!("{:03}", index))
            .replace("{date}", &today)
            .replace("{ext}", extension);

        // Ensure we have a valid filename with the original extension
        let new_filename = if new_stem.contains('.') {
            new_stem
        } else if !extension.is_empty() {
            format!("{}.{}", new_stem, extension)
        } else {
            new_stem
        };

        let output_path = out_dir.join(&new_filename);

        match std::fs::copy(input_path, &output_path) {
            Ok(_) => {
                let original_name = path
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or(input_path)
                    .to_string();
                result.results.push(RenameEntry {
                    original_name,
                    new_name: new_filename,
                });
                result.renamed_count += 1;
            }
            Err(e) => {
                result.errors.push(format!(
                    "Failed to copy '{}': {}",
                    input_path, e
                ));
            }
        }
    }

    result
}

/// Get today's date as YYYY-MM-DD using the `time` crate.
fn today_date() -> String {
    let now = OffsetDateTime::now_utc();
    format!(
        "{:04}-{:02}-{:02}",
        now.year(),
        now.month() as u8,
        now.day()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn today_date_format() {
        let date = today_date();
        // Must be YYYY-MM-DD
        assert_eq!(date.len(), 10);
        assert_eq!(&date[4..5], "-");
        assert_eq!(&date[7..8], "-");
        let year: i32 = date[0..4].parse().unwrap();
        let month: u32 = date[5..7].parse().unwrap();
        let day: u32 = date[8..10].parse().unwrap();
        assert!(year >= 2025);
        assert!((1..=12).contains(&month));
        assert!((1..=31).contains(&day));
    }
}
