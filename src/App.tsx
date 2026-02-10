import { useState } from "react";
import { Toaster } from "sonner";
import {
  Zap,
  ArrowRightLeft,
  FileDown,
  Scaling,
  ShieldOff,
  Stamp,
  FileUp,
} from "lucide-react";
import { cn } from "./lib/utils";
import appIcon from "./assets/icon.png";
import { TitleBar } from "./components/TitleBar";
import { CompressTab } from "./components/CompressTab";
import { ConvertTab } from "./components/ConvertTab";
import { ResizeTab } from "./components/ResizeTab";
import { WatermarkTab } from "./components/WatermarkTab";
import { ExifStripTab } from "./components/ExifStripTab";
import { PdfTab } from "./components/PdfTab";
import { ImagesToPdfTab } from "./components/ImagesToPdfTab";
import type { TabId } from "./types";
import "./App.css";

const TABS: { id: TabId; label: string; icon: typeof Zap }[] = [
  { id: "compress", label: "WebP Compress", icon: Zap },
  { id: "convert", label: "Convert", icon: ArrowRightLeft },
  { id: "resize", label: "Resize", icon: Scaling },
  { id: "watermark", label: "Watermark", icon: Stamp },
  { id: "strip", label: "EXIF Strip", icon: ShieldOff },
  { id: "pdf", label: "PDF Extract", icon: FileDown },
  { id: "images-to-pdf", label: "Images to PDF", icon: FileUp },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("compress");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex items-center gap-2.5 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <img src={appIcon} alt="Rust-ine" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-text-primary tracking-tight">
                Rust-ine
              </h1>
              <p className="text-[10px] text-text-muted">Image & PDF tools</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-3 mt-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-accent-muted text-accent"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-4 py-4">
            <div className="rounded-lg border border-border bg-background/50 px-3 py-2.5">
              <p className="text-[10px] text-text-muted leading-relaxed">
                Drag & drop files or click the drop zone to browse.
                Processing uses parallel Rust threads.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                {activeTab === "compress" &&
                  "Compress images to WebP format with adjustable quality."}
                {activeTab === "convert" &&
                  "Convert images between PNG, JPG, WebP, BMP, ICO and TIFF."}
                {activeTab === "resize" &&
                  "Batch resize images by percentage, width, height or exact dimensions."}
                {activeTab === "watermark" &&
                  "Add a text watermark to images with customizable position and opacity."}
                {activeTab === "strip" &&
                  "Remove EXIF, GPS and other metadata from images for privacy."}
                {activeTab === "pdf" &&
                  "Extract all embedded images from one or more PDF files."}
                {activeTab === "images-to-pdf" &&
                  "Combine multiple images into a single PDF document."}
              </p>
            </div>

            {activeTab === "compress" && <CompressTab />}
            {activeTab === "convert" && <ConvertTab />}
            {activeTab === "resize" && <ResizeTab />}
            {activeTab === "watermark" && <WatermarkTab />}
            {activeTab === "strip" && <ExifStripTab />}
            {activeTab === "pdf" && <PdfTab />}
            {activeTab === "images-to-pdf" && <ImagesToPdfTab />}
          </div>
        </main>
      </div>

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#12121a",
            border: "1px solid #2a2a3a",
            color: "#f1f1f4",
            fontSize: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
