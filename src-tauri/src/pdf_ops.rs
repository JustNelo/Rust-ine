use lopdf::{dictionary, Document as LopdfDocument, Object};
use pdfium_render::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::utils::{ensure_output_dir, embed_image_as_pdf_page, file_stem, filename_or_default};

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

    let pdf_stem = file_stem(pdf_path);

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

    let pdf_stem = file_stem(pdf_path);

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

// --- PDF Compression ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfCompressResult {
    pub output_path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub errors: Vec<String>,
}

/// Compress a PDF by re-encoding embedded images at lower JPEG quality.
/// Iterates over all stream objects, detects images, re-encodes them.
pub fn compress_pdf(
    pdf_path: &str,
    quality: u8,
    output_dir: &str,
) -> PdfCompressResult {
    let mut result = PdfCompressResult {
        output_path: String::new(),
        original_size: 0,
        compressed_size: 0,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    // Get original file size
    result.original_size = std::fs::metadata(pdf_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let mut doc = match LopdfDocument::load(pdf_path) {
        Ok(d) => d,
        Err(e) => {
            result.errors.push(format!("Cannot load PDF: {}", e));
            return result;
        }
    };

    // Collect object IDs that are image streams
    let object_ids: Vec<lopdf::ObjectId> = doc.objects.keys().copied().collect();

    for obj_id in object_ids {
        let is_image_stream = {
            if let Ok(stream) = doc.get_object(obj_id).and_then(|o| o.as_stream()) {
                let subtype = stream
                    .dict
                    .get(b"Subtype")
                    .ok()
                    .and_then(|v| v.as_name().ok())
                    .map(|n| std::str::from_utf8(n).unwrap_or("").to_string());
                subtype.as_deref() == Some("Image")
            } else {
                false
            }
        };

        if !is_image_stream {
            continue;
        }

        // Try to decode image data from the stream and re-encode as JPEG
        let recompressed = {
            if let Ok(stream) = doc.get_object(obj_id).and_then(|o| o.as_stream()) {
                let width = stream.dict.get(b"Width")
                    .ok()
                    .and_then(|v| v.as_i64().ok())
                    .unwrap_or(0) as u32;
                let height = stream.dict.get(b"Height")
                    .ok()
                    .and_then(|v| v.as_i64().ok())
                    .unwrap_or(0) as u32;

                if width == 0 || height == 0 {
                    None
                } else {
                    // Try to decode the raw content as an image
                    let content = &stream.content;
                    match image::load_from_memory(content) {
                        Ok(img) => {
                            let mut jpeg_buf = std::io::Cursor::new(Vec::new());
                            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                                &mut jpeg_buf,
                                quality,
                            );
                            match img.write_with_encoder(encoder) {
                                Ok(_) => Some((jpeg_buf.into_inner(), width, height)),
                                Err(_) => None,
                            }
                        }
                        Err(_) => None,
                    }
                }
            } else {
                None
            }
        };

        if let Some((jpeg_data, width, height)) = recompressed {
            // Only replace if compressed data is smaller
            let original_len = doc.get_object(obj_id)
                .ok()
                .and_then(|o| o.as_stream().ok())
                .map(|s| s.content.len())
                .unwrap_or(0);

            if jpeg_data.len() < original_len {
                let new_stream = lopdf::Stream::new(
                    lopdf::Dictionary::from_iter(vec![
                        ("Type", Object::Name(b"XObject".to_vec())),
                        ("Subtype", Object::Name(b"Image".to_vec())),
                        ("Width", Object::Integer(width as i64)),
                        ("Height", Object::Integer(height as i64)),
                        ("ColorSpace", Object::Name(b"DeviceRGB".to_vec())),
                        ("BitsPerComponent", Object::Integer(8)),
                        ("Filter", Object::Name(b"DCTDecode".to_vec())),
                        ("Length", Object::Integer(jpeg_data.len() as i64)),
                    ]),
                    jpeg_data,
                );
                doc.objects.insert(obj_id, Object::Stream(new_stream));
            }
        }
    }

    let pdf_stem = file_stem(pdf_path);
    let output_path = out_dir.join(format!("{}-compressed.pdf", pdf_stem));

    match doc.save(&output_path) {
        Ok(_) => {
            result.output_path = output_path.to_string_lossy().to_string();
            result.compressed_size = std::fs::metadata(&output_path)
                .map(|m| m.len())
                .unwrap_or(0);
        }
        Err(e) => {
            result.errors.push(format!("Cannot save compressed PDF: {}", e));
        }
    }

    result
}

// --- PDF Password Protection ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfProtectResult {
    pub output_path: String,
    pub success: bool,
    pub errors: Vec<String>,
}

/// Standard PDF padding string (Table 3.18, PDF Reference 1.7)
const PDF_PADDING: [u8; 32] = [
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
];

/// Pad or truncate a password to exactly 32 bytes per PDF spec
fn pad_password(password: &[u8]) -> [u8; 32] {
    let mut padded = [0u8; 32];
    let len = password.len().min(32);
    padded[..len].copy_from_slice(&password[..len]);
    if len < 32 {
        padded[len..].copy_from_slice(&PDF_PADDING[..(32 - len)]);
    }
    padded
}

/// Simple RC4 implementation for PDF encryption (40-bit key, per spec)
fn rc4_encrypt(key: &[u8], data: &[u8]) -> Vec<u8> {
    // KSA (Key-Scheduling Algorithm)
    let mut s: Vec<u8> = (0..=255).collect();
    let mut j: usize = 0;
    for i in 0..256 {
        j = (j + s[i] as usize + key[i % key.len()] as usize) % 256;
        s.swap(i, j);
    }
    // PRGA (Pseudo-Random Generation Algorithm)
    let mut i: usize = 0;
    j = 0;
    let mut output = Vec::with_capacity(data.len());
    for &byte in data {
        i = (i + 1) % 256;
        j = (j + s[i] as usize) % 256;
        s.swap(i, j);
        let k = s[(s[i] as usize + s[j] as usize) % 256];
        output.push(byte ^ k);
    }
    output
}

/// Compute the O (owner) value — Algorithm 3, PDF Reference 1.7
/// For R=2, V=1 (40-bit RC4)
fn compute_o_value(owner_password: &[u8], user_password: &[u8]) -> Vec<u8> {
    let owner_padded = pad_password(owner_password);
    let key_hash = md5::compute(&owner_padded);
    // For R=2: use the first 5 bytes of the hash as the RC4 key
    let key = &key_hash[..5];
    let user_padded = pad_password(user_password);
    rc4_encrypt(key, &user_padded)
}

/// Compute the global encryption key — Algorithm 2, PDF Reference 1.7
/// For R=2, V=1 (40-bit RC4): returns 5 bytes
fn compute_encryption_key(
    user_password: &[u8],
    o_value: &[u8],
    permissions: i32,
    file_id: &[u8],
) -> Vec<u8> {
    let user_padded = pad_password(user_password);
    let mut digest_input = Vec::with_capacity(68 + file_id.len());
    digest_input.extend_from_slice(&user_padded);
    digest_input.extend_from_slice(o_value);
    digest_input.extend_from_slice(&permissions.to_le_bytes());
    digest_input.extend_from_slice(file_id);
    let key_hash = md5::compute(&digest_input);
    key_hash[..5].to_vec()
}

/// Compute the per-object encryption key — Algorithm 1, PDF Reference 1.7
/// Appends the 3-byte LE object number and 2-byte LE generation number to the
/// global key, hashes with MD5, and truncates to min(n+5, 16) bytes.
fn compute_object_key(global_key: &[u8], obj_num: u32, gen_num: u16) -> Vec<u8> {
    let mut data = Vec::with_capacity(global_key.len() + 5);
    data.extend_from_slice(global_key);
    data.push((obj_num & 0xFF) as u8);
    data.push(((obj_num >> 8) & 0xFF) as u8);
    data.push(((obj_num >> 16) & 0xFF) as u8);
    data.push((gen_num & 0xFF) as u8);
    data.push(((gen_num >> 8) & 0xFF) as u8);
    let hash = md5::compute(&data);
    let key_len = (global_key.len() + 5).min(16);
    hash[..key_len].to_vec()
}

/// Recursively RC4-encrypt all String values and Stream data inside a lopdf Object.
fn encrypt_object(obj: &mut Object, obj_key: &[u8]) {
    match obj {
        Object::String(ref mut data, _) => {
            *data = rc4_encrypt(obj_key, data);
        }
        Object::Array(ref mut arr) => {
            for item in arr.iter_mut() {
                encrypt_object(item, obj_key);
            }
        }
        Object::Dictionary(ref mut dict) => {
            encrypt_dictionary(dict, obj_key);
        }
        Object::Stream(ref mut stream) => {
            // Encrypt the raw stream bytes (compression filters stay intact —
            // the reader will first decrypt, then decompress)
            stream.content = rc4_encrypt(obj_key, &stream.content);
            // Also encrypt any string values living inside the stream dictionary
            encrypt_dictionary(&mut stream.dict, obj_key);
        }
        _ => {}
    }
}

/// Encrypt all values in a lopdf Dictionary (keys are Names and are never encrypted).
fn encrypt_dictionary(dict: &mut lopdf::Dictionary, obj_key: &[u8]) {
    for (_, value) in dict.iter_mut() {
        encrypt_object(value, obj_key);
    }
}

/// Protect a PDF with a user password using proper PDF Standard Security Handler.
/// Implements Algorithms 1-4 from PDF 1.7 spec (R=2, V=1, 40-bit RC4).
/// All indirect-object strings and streams are RC4-encrypted with per-object keys
/// so that readers can actually decrypt and display the content.
pub fn protect_pdf(
    _pdfium_path: &str,
    pdf_path: &str,
    password: &str,
    output_dir: &str,
) -> PdfProtectResult {
    let mut result = PdfProtectResult {
        output_path: String::new(),
        success: false,
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
            result.errors.push(format!("Cannot open PDF: {}", e));
            return result;
        }
    };

    let pw_bytes = password.as_bytes();

    // Get or create a file ID for the document (required for encryption)
    let file_id: Vec<u8> = doc
        .trailer
        .get(b"ID")
        .ok()
        .and_then(|id_obj| {
            if let Object::Array(ref arr) = *id_obj {
                arr.first().and_then(|first| {
                    if let Object::String(ref s, _) = *first {
                        Some(s.clone())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        })
        .unwrap_or_else(|| {
            let hash = md5::compute(pdf_path.as_bytes());
            hash.0.to_vec()
        });

    // Permissions: allow everything except extraction (-4 = 0xFFFFFFFC)
    let permissions: i32 = -4;

    // Algorithm 3 — O value (owner_password = user_password for single-password mode)
    let o_value = compute_o_value(pw_bytes, pw_bytes);

    // Algorithm 2 — global encryption key (5 bytes for 40-bit RC4)
    let global_key = compute_encryption_key(pw_bytes, &o_value, permissions, &file_id);

    // Algorithm 4 — U value = RC4(global_key, PDF_PADDING)
    let u_value = rc4_encrypt(&global_key, &PDF_PADDING);

    // ── Encrypt every indirect object in the document ──────────────────
    let object_ids: Vec<(u32, u16)> = doc.objects.keys().cloned().collect();
    for (obj_num, gen_num) in &object_ids {
        let obj_key = compute_object_key(&global_key, *obj_num, *gen_num);
        if let Some(obj) = doc.objects.get_mut(&(*obj_num, *gen_num)) {
            encrypt_object(obj, &obj_key);
        }
    }

    // ── Add the Encrypt dictionary AFTER encrypting (it must stay clear) ─
    let encrypt_dict = dictionary! {
        "Filter" => Object::Name(b"Standard".to_vec()),
        "V" => Object::Integer(1),
        "R" => Object::Integer(2),
        "Length" => Object::Integer(40),
        "P" => Object::Integer(permissions as i64),
        "O" => Object::String(o_value, lopdf::StringFormat::Literal),
        "U" => Object::String(u_value, lopdf::StringFormat::Literal)
    };

    let encrypt_id = doc.add_object(Object::Dictionary(encrypt_dict));
    doc.trailer.set("Encrypt", Object::Reference(encrypt_id));

    // Ensure the document has an ID array in the trailer
    if doc.trailer.get(b"ID").is_err() {
        let id_string = Object::String(file_id.clone(), lopdf::StringFormat::Literal);
        doc.trailer.set(
            "ID",
            Object::Array(vec![id_string.clone(), id_string]),
        );
    }

    let pdf_stem = file_stem(pdf_path);
    let output_path = out_dir.join(format!("{}-protected.pdf", pdf_stem));

    match doc.save(&output_path) {
        Ok(_) => {
            result.output_path = output_path.to_string_lossy().to_string();
            result.success = true;
        }
        Err(e) => {
            result.errors.push(format!("Cannot save protected PDF: {}", e));
        }
    }

    result
}

/// Unlock a password-protected PDF using pdfium-render.
/// Opens the PDF with the given password, then saves it without encryption.
pub fn unlock_pdf(
    pdfium_path: &str,
    pdf_path: &str,
    password: &str,
    output_dir: &str,
) -> PdfProtectResult {
    let mut result = PdfProtectResult {
        output_path: String::new(),
        success: false,
        errors: Vec::new(),
    };

    let out_dir = PathBuf::from(output_dir);
    if let Err(e) = ensure_output_dir(&out_dir) {
        result.errors.push(e);
        return result;
    }

    let bindings = match Pdfium::bind_to_library(pdfium_path) {
        Ok(b) => b,
        Err(e) => {
            result.errors.push(format!("Cannot load pdfium: {}", e));
            return result;
        }
    };
    let pdfium = Pdfium::new(bindings);

    let doc = match pdfium.load_pdf_from_file(pdf_path, Some(password)) {
        Ok(d) => d,
        Err(e) => {
            result.errors.push(format!("Cannot unlock PDF (wrong password?): {}", e));
            return result;
        }
    };

    let pdf_stem = file_stem(pdf_path);
    let output_path = out_dir.join(format!("{}-unlocked.pdf", pdf_stem));

    // Save without encryption — pdfium strips password on save
    match doc.save_to_file(&output_path) {
        Ok(_) => {
            result.output_path = output_path.to_string_lossy().to_string();
            result.success = true;
        }
        Err(e) => {
            result.errors.push(format!("Cannot save unlocked PDF: {}", e));
        }
    }

    result
}
