use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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

    let today = chrono_free_date();

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

/// Get today's date as YYYY-MM-DD without pulling in the chrono crate.
fn chrono_free_date() -> String {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    // Simple date calculation (no leap second precision needed)
    let days = secs / 86400;
    let mut y = 1970i32;
    let mut remaining_days = days as i32;

    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }

    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 1u32;
    for &md in &month_days {
        if remaining_days < md {
            break;
        }
        remaining_days -= md;
        m += 1;
    }
    let d = remaining_days + 1;

    format!("{:04}-{:02}-{:02}", y, m, d)
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
