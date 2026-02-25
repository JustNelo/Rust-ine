use exif::{In, Tag};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MetadataEntry {
    pub tag: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageMetadata {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub file_size: u64,
    pub exif: Vec<MetadataEntry>,
}

const EXIF_TAGS: &[(Tag, &str)] = &[
    (Tag::Make, "Camera Make"),
    (Tag::Model, "Camera Model"),
    (Tag::DateTime, "Date/Time"),
    (Tag::DateTimeOriginal, "Date/Time Original"),
    (Tag::ExposureTime, "Exposure Time"),
    (Tag::FNumber, "F-Number"),
    (Tag::ISOSpeed, "ISO Speed"),
    (Tag::FocalLength, "Focal Length"),
    (Tag::FocalLengthIn35mmFilm, "Focal Length (35mm)"),
    (Tag::MeteringMode, "Metering Mode"),
    (Tag::Flash, "Flash"),
    (Tag::WhiteBalance, "White Balance"),
    (Tag::ExposureMode, "Exposure Mode"),
    (Tag::ImageWidth, "EXIF Width"),
    (Tag::ImageLength, "EXIF Height"),
    (Tag::Orientation, "Orientation"),
    (Tag::XResolution, "X Resolution"),
    (Tag::YResolution, "Y Resolution"),
    (Tag::Software, "Software"),
    (Tag::Artist, "Artist"),
    (Tag::Copyright, "Copyright"),
    (Tag::GPSLatitude, "GPS Latitude"),
    (Tag::GPSLongitude, "GPS Longitude"),
    (Tag::GPSAltitude, "GPS Altitude"),
    (Tag::LensModel, "Lens Model"),
    (Tag::ColorSpace, "Color Space"),
    (Tag::PixelXDimension, "Pixel Width"),
    (Tag::PixelYDimension, "Pixel Height"),
];

pub fn read_image_metadata(path: &str) -> Result<ImageMetadata, String> {
    let reader = image::ImageReader::open(path).map_err(|e| format!("Cannot open file: {}", e))?;

    // Read dimensions from header only — avoids decoding the full image
    let (width, height) = reader
        .into_dimensions()
        .map_err(|e| format!("Cannot read image dimensions: {}", e))?;

    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_uppercase())
        .unwrap_or_else(|| "UNKNOWN".to_string());

    let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let mut exif_entries: Vec<MetadataEntry> = Vec::new();

    let file = fs::File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
    let mut buf_reader = std::io::BufReader::new(&file);

    if let Ok(exif_data) = exif::Reader::new().read_from_container(&mut buf_reader) {
        for &(tag, label) in EXIF_TAGS {
            if let Some(field) = exif_data.get_field(tag, In::PRIMARY) {
                let value = field.display_value().with_unit(&exif_data).to_string();
                if !value.is_empty() && value != "unknown" {
                    exif_entries.push(MetadataEntry {
                        tag: label.to_string(),
                        value,
                    });
                }
            }
        }
    }

    Ok(ImageMetadata {
        path: path.to_string(),
        width,
        height,
        format: ext,
        file_size: size,
        exif: exif_entries,
    })
}
