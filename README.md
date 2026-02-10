# Rust-ine

Rust-ine is a lightweight desktop application for batch image compression, format conversion, and PDF image extraction. It is built with Tauri v2 and leverages a Rust backend for fast, parallel processing while providing a clean React-based interface.

---

## Features

### WebP Compression

Compress one or more images to WebP format. Files are processed in parallel using Rayon, so large batches complete quickly. The quality parameter is passed directly to the WebP encoder.

### Image Format Conversion

Convert images between the following formats:

- PNG
- JPEG
- WebP
- BMP
- ICO (automatically resized to 256x256)
- TIFF

### PDF Image Extraction

Extract all embedded images from a PDF file. The extractor handles the most common PDF image encodings:

- **DCTDecode** -- JPEG streams, written directly as `.jpg`
- **FlateDecode** -- raw pixel data, reconstructed and saved as `.png`
- **JPXDecode** -- JPEG 2000 streams, written as `.jp2`
- **CCITTFaxDecode** -- fax-encoded images, written as `.tiff`
- Unknown formats are detected by magic bytes and saved with the appropriate extension.

---

## Tech Stack

| Layer    | Technology                                                  |
| -------- | ----------------------------------------------------------- |
| Runtime  | [Tauri v2](https://v2.tauri.app/) (Rust + WebView)         |
| Backend  | Rust, Rayon, image, webp, lopdf, Tokio                     |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 7              |
| UI       | Custom dark theme, Lucide icons, Sonner toasts              |
| Bundler  | Bun (package manager and script runner)                     |

---

## Project Structure

```
Rust-ine/
  src/                        # Frontend (React + TypeScript)
    components/               # UI components (TitleBar, DropZone, FileList, ...)
    hooks/                    # Shared React hooks (useFileSelection, useOutputDir)
    lib/                      # Utility functions
    types.ts                  # Shared TypeScript interfaces
    App.tsx                   # Main application shell with sidebar navigation
    App.css                   # Tailwind theme and global styles
  src-tauri/                  # Backend (Rust)
    src/
      lib.rs                  # Tauri command handlers and path validation
      image_ops.rs            # Image compression and conversion logic
      pdf_ops.rs              # PDF image extraction logic
      main.rs                 # Application entry point
    capabilities/
      default.json            # Tauri permission declarations
    Cargo.toml                # Rust dependencies
  index.html                  # HTML entry point
  package.json                # Frontend dependencies
  vite.config.ts              # Vite configuration
```

---

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Bun](https://bun.sh/) (or Node.js >= 18 with npm)
- Platform-specific Tauri v2 dependencies -- see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

---

## Getting Started

### Install dependencies

```bash
bun install
```

### Run in development mode

```bash
bun run tauri dev
```

This starts both the Vite dev server (with HMR) and the Tauri application window.

### Build for production

```bash
bun run tauri build
```

The compiled binary and installer will be placed in `src-tauri/target/release/bundle/`.

---

## Architecture Notes

### Backend

All three Tauri commands (`compress_webp`, `convert_images`, `extract_pdf_images`) are thin async wrappers that:

1. Validate input paths against path traversal attacks (rejecting relative paths and `..` segments).
2. Offload CPU-intensive work to a blocking thread via `tokio::task::spawn_blocking`.
3. Use `rayon::par_iter` for parallel image processing within each batch.

This ensures the Tauri main thread is never blocked by heavy computation.

### Frontend

The React frontend follows a component-per-tab architecture. Shared logic is extracted into custom hooks (`useFileSelection`, `useOutputDir`) to avoid duplication. The `DropZone` component handles both native drag-and-drop events (via Tauri's `onDragDropEvent`) and click-to-browse dialogs.

### Security

- A restrictive Content Security Policy is enforced in `tauri.conf.json`.
- File system paths received from the frontend are validated server-side before any I/O operation.
- Tauri capabilities are scoped to the minimum required permissions.

---

## License

This project is private and not currently published under an open-source license.