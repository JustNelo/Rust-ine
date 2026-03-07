<div align="center">

<img src="rust-ine-app-icon.png" width="120" alt="Rust-ine icon" />

# Rust-ine

**Image & PDF Swiss Army Knife**

A fast, modern desktop app for batch image processing, PDF manipulation, and developer utilities.
Built with **Tauri v2** and powered by parallel **Rust** processing.

[![Build & Release](https://github.com/JustNelo/Rust-ine/actions/workflows/release.yml/badge.svg)](https://github.com/JustNelo/Rust-ine/actions/workflows/release.yml)
[![Version](https://img.shields.io/github/v/tag/JustNelo/Rust-ine?label=version&color=6366f1)](https://github.com/JustNelo/Rust-ine/releases/latest)
[![License](https://img.shields.io/badge/license-Source%20Available-blue)](https://github.com/JustNelo/Rust-ine#license)

[Download](#-download) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Architecture](#-architecture)

</div>

---

## 📦 Download

Grab the latest installer from the [**Releases page**](https://github.com/JustNelo/Rust-ine/releases/latest).

| Platform | File | Format |
| :------- | :--- | :----- |
| Windows  | `Rust-ine_x.x.x_x64-setup.exe` | NSIS installer |
| Linux    | `Rust-ine_x.x.x_amd64.deb` / `.rpm` / `.AppImage` | DEB / RPM / AppImage |

> The app includes **built-in auto-updates** — you'll be notified when a new version is available.

---

## ✨ Features

### 🖼️ Image Tools

| Tool | Description |
| :--- | :---------- |
| **Compress** | Batch compress to WebP or JPEG with adjustable quality slider |
| **Convert** | Convert between PNG, JPEG, WebP, BMP, ICO, TIFF formats |
| **Resize** | Resize with presets (1080p, 4K, Instagram, YouTube) or custom dimensions |
| **Crop** | Interactive crop with draggable handles and rule-of-thirds grid |
| **Optimize** | Lossless PNG optimization via OxiPNG |
| **Watermark** | Add text or image watermarks with live preview and tiled mode |
| **EXIF Strip** | Remove metadata with detailed before/after view |
| **Color Palette** | Extract dominant colors from images |
| **SVG Rasterize** | Convert SVG files to PNG or WebP at any target width |

### 📄 PDF Toolkit

| Tool | Description |
| :--- | :---------- |
| **Extract Images** | Extract embedded images from PDFs (JPEG, PNG, JPEG2000, TIFF, CCITT) |
| **PDF to Images** | Render pages to images at custom DPI (72–1200) |
| **Compress** | Reduce file size by re-encoding embedded images |
| **Split** | Split PDFs by page ranges (`1-3, 5, 8-end`) |
| **Merge / Builder** | Merge images and PDFs into a new document with drag-and-drop reordering |
| **Protect** | Password-protect PDFs (PDF 1.7 standard security handler) |
| **Unlock** | Remove password protection from PDFs |
| **Text Watermark** | Overlay text watermarks on PDF pages with positioning and opacity |
| **Image Watermark** | Stamp image watermarks on PDF pages with transparency support |

### 🛠️ Developer Tools

| Tool | Description |
| :--- | :---------- |
| **Favicon Generator** | Generate multi-size `.ico`, PNGs and `webmanifest` from any image |
| **GIF / Animation** | Create animated GIFs from image sequences with reordering |
| **Sprite Sheet** | Combine images into a sprite sheet + JSON atlas |
| **Image to Base64** | Convert images to data URI strings with one-click copy |
| **QR Code** | Generate QR code PNGs from text or URLs |
| **Bulk Rename** | Rename files with pattern tokens (`{name}`, `{index}`, `{date}`, `{ext}`) |

### 🎨 User Experience

- **Before/After Slider** — drag to compare original vs processed images
- **Results Banner** — thumbnails, size stats, compression %, per-file feedback
- **Global Progress Bar** — real-time batch progress with cancel button
- **Dark / Light Theme** — glassmorphism UI with ambient background
- **Internationalization** — English & French
- **Onboarding** — guided workspace setup on first launch
- **Session History** — review past operations
- **Keyboard Shortcuts** — `Ctrl+O` open, `Ctrl+V` paste, `Ctrl+L` clear
- **Auto-updater** — one-click update from Settings

---

## 🔧 Tech Stack

| Layer | Technology |
| :---- | :--------- |
| **Runtime** | [Tauri v2](https://v2.tauri.app/) — Rust backend + native WebView |
| **Backend** | Rust 2021 · Rayon · image · webp · lopdf · pdfium-render · OxiPNG · Tokio |
| **Frontend** | React 19 · TypeScript · Tailwind CSS v4 · Vite 7 |
| **UI** | shadcn/ui patterns · Lucide icons · Sonner toasts · dnd-kit |
| **Package Manager** | [Bun](https://bun.sh/) |
| **CI/CD** | GitHub Actions — lint, test, build & release for Windows + Linux |

---

## 🚀 Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain with `clippy` and `rustfmt`)
- [Bun](https://bun.sh/) (or Node.js >= 18)
- Platform-specific Tauri v2 system deps — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)
- PDFium library in `src-tauri/resources/` (`pdfium.dll` on Windows, `libpdfium.so` on Linux)

### Install & Run

```bash
# Install frontend dependencies
bun install

# Run in development mode
bun run tauri dev

# Build for production
bun run tauri build
```

The compiled binary and installer will be in `src-tauri/target/release/bundle/`.

### Lint & Test

```bash
cd src-tauri

# Format check
cargo fmt --check

# Lint
cargo clippy -- -D warnings

# Unit tests
cargo test
```

---

## 🏛️ Architecture

### Backend (Rust)

Every Tauri command follows the same pattern:

1. **Validate** input paths against traversal attacks (absolute-only, no `..`, symlink resolution, allowed-directory check).
2. **Offload** CPU-intensive work to `tokio::task::spawn_blocking`.
3. **Parallelize** image batches with `rayon::par_iter`.
4. **Report** progress in real-time via Tauri events.

```
src-tauri/src/
├── lib.rs              # Tauri commands, path validation, app setup
├── image_ops.rs        # Image processing (compress, convert, resize, crop, watermark…)
├── pdf_ops.rs          # PDF operations (extract, convert, compress, protect, unlock)
├── pdf_builder_ops.rs  # PDF merge & thumbnail generation
├── pdf_split_ops.rs    # PDF splitting by page ranges
├── pdf_watermark_ops.rs# PDF watermarking (text & image)
├── gif_ops.rs          # Animated GIF creation
├── color_ops.rs        # Dominant color extraction
├── favicon_ops.rs      # Favicon generation (ICO, PNG, webmanifest)
├── metadata_ops.rs     # EXIF & image metadata reading
├── rename_ops.rs       # Bulk file renaming
├── sprite_ops.rs       # Sprite sheet generation
├── svg_ops.rs          # SVG rasterization
├── qr_ops.rs           # QR code generation
├── utils.rs            # Shared utilities (path helpers, hex parsing, PDF embedding)
└── progress.rs         # Progress event emission
```

### Frontend (React + TypeScript)

Component-per-tab architecture with shared hooks (`useFileSelection`, `useWorkspace`, `useProcessingProgress`) and reusable UI primitives (`ActionButton`, `Slider`, `DropZone`, `BeforeAfterSlider`, `ImageGrid`).

### Security

- **CSP** — restrictive `default-src 'self'` policy in `tauri.conf.json`
- **Path validation** — all file paths checked for traversal, symlink escapes, and allowed-directory membership
- **Scoped permissions** — Tauri capabilities limited to user directories only
- **Input sanitization** — all numeric parameters clamped, file stems validated
- **No shell execution** — zero `Command::new` calls

---

## 📄 License

Copyright &copy; 2025-2026 Léon Gallet.

This is a **Source Available** project. You are welcome to explore the code and run it for personal use. Redistribution, sub-licensing, or any commercial exploitation of the code or the application is strictly forbidden.