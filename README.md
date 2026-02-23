# Rust-ine

**Image & PDF Swiss Army Knife** — A fast, modern desktop app for batch image processing, PDF manipulation, and developer utilities. Built with Tauri v2 and powered by parallel Rust processing.

---

## Download

Grab the latest installer from the [Releases page](https://github.com/JustNelo/Rust-ine/releases/latest).

| Platform | File |
| -------- | ---- |
| Windows  | `Rust-ine_x.x.x_x64-setup.exe` (NSIS installer) |

The app includes **built-in auto-updates** — you'll be notified when a new version is available.

---

## Features

### Image Tools

- **WebP Compress** — Batch compress images to WebP with adjustable quality slider
- **Convert** — Convert between PNG, JPEG, WebP, BMP, ICO, TIFF formats
- **Resize** — Batch resize with presets (1080p, 4K, Instagram, YouTube) or custom dimensions
- **Crop** — Interactive free-form crop with draggable rectangle, corner/edge handles, and rule-of-thirds grid
- **Watermark** — Add text watermarks with live preview
- **EXIF Strip** — Remove metadata from images with detailed before/after view
- **Optimize** — Lossless PNG optimization via OxiPNG
- **Color Palette** — Extract dominant colors from images
- **Favicon Generator** — Generate multi-size `.ico` favicons from any image
- **GIF / Animated WebP** — Create animations from image sequences with drag-and-drop reordering
- **Sprite Sheet** — Combine images into a single sprite sheet

### PDF Tools

- **PDF Extract** — Extract embedded images from PDFs (JPEG, PNG, JPEG2000, TIFF, CCITT)
- **PDF to Images** — Render PDF pages to images at custom DPI
- **PDF Compress** — Reduce PDF file size
- **PDF Split** — Split PDFs by page ranges
- **PDF Builder** — Merge images and PDFs into a new document with page reordering
- **PDF Protect** — Password-protect PDFs with proper RC4 encryption (PDF 1.7 spec)
- **PDF Unlock** — Remove password protection from PDFs

### Developer Tools

- **Image to Base64** — Convert images to data URI strings with one-click copy
- **QR Code Generator** — Generate QR codes from text or URLs
- **Bulk Rename** — Batch rename files with pattern tokens (`{name}`, `{index}`, `{date}`, `{ext}`)

### UX

- **Before/After Slider** — Compare original vs processed images with a smooth drag slider
- **Results Banner** — Thumbnails, size stats, and per-file success/error feedback
- **Dark UI** — Custom glassmorphism dark theme
- **i18n** — English and French
- **Auto-updater** — Check for updates from Settings

---

## Tech Stack

| Layer    | Technology                                                         |
| -------- | ------------------------------------------------------------------ |
| Runtime  | [Tauri v2](https://v2.tauri.app/) (Rust + WebView)                |
| Backend  | Rust 2021, Rayon, image, webp, lopdf, pdfium-render, OxiPNG, Tokio |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 7                     |
| UI       | shadcn/ui patterns, Lucide icons, Sonner toasts                   |
| Bundler  | Bun (package manager and script runner)                            |

---

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Bun](https://bun.sh/) (or Node.js >= 18 with npm)
- Platform-specific Tauri v2 dependencies — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)
- `pdfium.dll` in `src-tauri/resources/` (required for PDF features on Windows)

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

### Build for production

```bash
bun run tauri build
```

The compiled binary and installer will be placed in `src-tauri/target/release/bundle/`.

---

## Architecture

### Backend

Every Tauri command is a thin async wrapper that:

1. Validates input paths against traversal attacks (rejecting relative paths, `..` segments, and symlink escapes).
2. Offloads CPU-intensive work to a blocking thread via `tokio::task::spawn_blocking`.
3. Uses `rayon::par_iter` for parallel image processing within each batch.

### Frontend

Component-per-tab architecture with shared hooks (`useFileSelection`, `useWorkspace`) and reusable UI components (`ActionButton`, `Slider`, `DropZone`, `BeforeAfterSlider`).

### Security

- Restrictive CSP enforced in `tauri.conf.json`
- Server-side path validation with symlink resolution
- Scoped Tauri capabilities (minimum required permissions)

---

## License

This project is private and not currently published under an open-source license.