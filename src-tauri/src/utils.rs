use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document as LopdfDocument, Object, Stream};
use image::codecs::jpeg::JpegEncoder;
use std::fs;
use std::io::Cursor;
use std::path::Path;

/// Create the output directory if it does not exist.
pub fn ensure_output_dir(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Cannot create output directory: {}", e))?;
    }
    Ok(())
}

/// Extract the filename from a path, falling back to the full path string.
pub fn filename_or_default(path: &str) -> &str {
    Path::new(path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(path)
}

/// Get the file size in bytes, returning 0 on error.
pub fn file_size(path: &str) -> u64 {
    fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

/// Get the lowercase file extension, defaulting to "png".
pub fn get_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "png".to_string())
}

/// Embed an image file as a single PDF page with JPEG encoding.
/// Returns the ObjectId of the created page.
pub fn embed_image_as_pdf_page(
    doc: &mut LopdfDocument,
    pages_id: lopdf::ObjectId,
    image_path: &str,
    page_w: f32,
    page_h: f32,
    margin: f32,
    jpeg_quality: u8,
) -> Result<lopdf::ObjectId, String> {
    let img = image::open(image_path)
        .map_err(|e| format!("Cannot open image '{}': {}", image_path, e))?
        .into_rgb8();

    let (img_w, img_h) = (img.width(), img.height());

    let mut jpeg_buf: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_buf);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, jpeg_quality);
    img.write_with_encoder(encoder)
        .map_err(|e| format!("JPEG encode failed: {}", e))?;

    let available_w = page_w - 2.0 * margin;
    let available_h = page_h - 2.0 * margin;

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
