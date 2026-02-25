import { useState, useMemo, useCallback, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Toaster } from "sonner";
import {
  Zap,
  ArrowRightLeft,
  FileDown,
  Scaling,
  ShieldOff,
  Stamp,
  FileUp,
  Settings,
  Sparkles,
  Crop,
  Image,
  Scissors,
  ChevronDown,
  Pipette,
  Globe,
  FileArchive,
  Film,
  LayoutGrid,
  Lock,
  Code,
  QrCode,
  PenLine,
} from "lucide-react";
import { cn } from "./lib/utils";
import appIcon from "./assets/icon.png";
import { TitleBar } from "./components/TitleBar";
import { CompressTab } from "./components/CompressTab";
import { ConvertTab } from "./components/ConvertTab";
import { ResizeTab } from "./components/ResizeTab";
import { WatermarkTab } from "./components/WatermarkTab";
import { ExifStripTab } from "./components/ExifStripTab";
import { OptimizeTab } from "./components/OptimizeTab";
import { CropTab } from "./components/CropTab";
import { PdfTab } from "./components/PdfTab";
import { PdfBuilderTab } from "./components/PdfBuilderTab";
import { PdfToImagesTab } from "./components/PdfToImagesTab";
import { PdfSplitTab } from "./components/PdfSplitTab";
import { PaletteTab } from "./components/PaletteTab";
import { FaviconTab } from "./components/FaviconTab";
import { PdfCompressTab } from "./components/PdfCompressTab";
import { AnimationTab } from "./components/AnimationTab";
import { SpriteSheetTab } from "./components/SpriteSheetTab";
import { PdfProtectTab } from "./components/PdfProtectTab";
import { Base64Tab } from "./components/Base64Tab";
import { QrCodeTab } from "./components/QrCodeTab";
import { BulkRenameTab } from "./components/BulkRenameTab";
import { GlobalProgressBar } from "./components/GlobalProgressBar";
import { SplashScreen } from "./components/SplashScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { OnboardingModal } from "./components/OnboardingModal";
import { UpdateBanner } from "./components/UpdateBanner";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { useT } from "./i18n/i18n";
import type { TabId } from "./types";
import "./App.css";

const TAB_EXTENSIONS: Record<TabId, string[]> = {
  compress: ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp"],
  convert: ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "gif"],
  resize: ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "gif"],
  watermark: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  strip: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  optimize: ["png", "jpg", "jpeg"],
  crop: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  pdf: ["pdf"],
  "pdf-builder": ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf"],
  palette: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  "pdf-to-images": ["pdf"],
  "pdf-split": ["pdf"],
  "pdf-compress": ["pdf"],
  favicon: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  animation: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  spritesheet: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  "pdf-protect": ["pdf"],
  base64: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "tiff", "tif"],
  qrcode: [],
  "bulk-rename": ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp", "gif", "ico", "svg"],
};

interface TabDef {
  id: TabId;
  labelKey: string;
  icon: typeof Zap;
}

interface SidebarSection {
  titleKey: string;
  tabs: TabDef[];
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    titleKey: "section.image_tools",
    tabs: [
      { id: "compress", labelKey: "tab.compress", icon: Zap },
      { id: "convert", labelKey: "tab.convert", icon: ArrowRightLeft },
      { id: "resize", labelKey: "tab.resize", icon: Scaling },
      { id: "crop", labelKey: "tab.crop", icon: Crop },
      { id: "optimize", labelKey: "tab.optimize", icon: Sparkles },
      { id: "watermark", labelKey: "tab.watermark", icon: Stamp },
      { id: "strip", labelKey: "tab.strip", icon: ShieldOff },
      { id: "palette", labelKey: "tab.palette", icon: Pipette },
    ],
  },
  {
    titleKey: "section.pdf_tools",
    tabs: [
      { id: "pdf", labelKey: "tab.pdf", icon: FileDown },
      { id: "pdf-builder", labelKey: "tab.pdf_builder", icon: FileUp },
      { id: "pdf-to-images", labelKey: "tab.pdf_to_images", icon: Image },
      { id: "pdf-split", labelKey: "tab.pdf_split", icon: Scissors },
      { id: "pdf-compress", labelKey: "tab.pdf_compress", icon: FileArchive },
      { id: "pdf-protect", labelKey: "tab.pdf_protect", icon: Lock },
    ],
  },
  {
    titleKey: "section.dev_tools",
    tabs: [
      { id: "favicon", labelKey: "tab.favicon", icon: Globe },
      { id: "animation", labelKey: "tab.animation", icon: Film },
      { id: "spritesheet", labelKey: "tab.spritesheet", icon: LayoutGrid },
      { id: "base64", labelKey: "tab.base64", icon: Code },
      { id: "qrcode", labelKey: "tab.qrcode", icon: QrCode },
      { id: "bulk-rename", labelKey: "tab.bulk_rename", icon: PenLine },
    ],
  },
];

const TAB_DESC_KEYS: Record<TabId, string> = {
  compress: "tab.compress.desc",
  convert: "tab.convert.desc",
  resize: "tab.resize.desc",
  watermark: "tab.watermark.desc",
  strip: "tab.strip.desc",
  optimize: "tab.optimize.desc",
  crop: "tab.crop.desc",
  pdf: "tab.pdf.desc",
  "pdf-builder": "tab.pdf_builder.desc",
  palette: "tab.palette.desc",
  "pdf-to-images": "tab.pdf_to_images.desc",
  "pdf-split": "tab.pdf_split.desc",
  "pdf-compress": "tab.pdf_compress.desc",
  favicon: "tab.favicon.desc",
  animation: "tab.animation.desc",
  spritesheet: "tab.spritesheet.desc",
  "pdf-protect": "tab.pdf_protect.desc",
  base64: "tab.base64.desc",
  qrcode: "tab.qrcode.desc",
  "bulk-rename": "tab.bulk_rename.desc",
};

const TAB_LABEL_KEYS: Record<TabId, string> = {
  compress: "tab.compress",
  convert: "tab.convert",
  resize: "tab.resize",
  watermark: "tab.watermark",
  strip: "tab.strip",
  optimize: "tab.optimize",
  crop: "tab.crop",
  pdf: "tab.pdf",
  "pdf-builder": "tab.pdf_builder",
  palette: "tab.palette",
  "pdf-to-images": "tab.pdf_to_images",
  "pdf-split": "tab.pdf_split",
  "pdf-compress": "tab.pdf_compress",
  favicon: "tab.favicon",
  animation: "tab.animation",
  spritesheet: "tab.spritesheet",
  "pdf-protect": "tab.pdf_protect",
  base64: "tab.base64",
  qrcode: "tab.qrcode",
  "bulk-rename": "tab.bulk_rename",
};

function App() {
  const { t } = useT();
  const { status: updateStatus, version: updateVersion, install: installUpdate, dismiss: dismissUpdate } = useAutoUpdate();
  const [appVersion, setAppVersion] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("compress");
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem("rustine_onboarded") !== "1"; } catch { return true; }
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    getVersion().then((v) => setAppVersion(v)).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  const activeExtensions = useMemo(() => TAB_EXTENSIONS[activeTab], [activeTab]);

  const handleShortcutFiles = useCallback((paths: string[]) => {
    // Dispatch a custom event that tab components can listen to
    window.dispatchEvent(
      new CustomEvent("rustine-shortcut-files", { detail: paths })
    );
  }, []);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((titleKey: string) => {
    setCollapsedSections((prev) => ({ ...prev, [titleKey]: !prev[titleKey] }));
  }, []);

  useGlobalShortcuts({
    acceptExtensions: activeExtensions,
    onFilesSelected: handleShortcutFiles,
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <UpdateBanner status={updateStatus} version={updateVersion} onInstall={installUpdate} onDismiss={dismissUpdate} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border" style={{ background: 'rgba(108,108,237,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 shadow-[0_0_12px_rgba(108,108,237,0.25)]">
              <img src={appIcon} alt="Rust-ine" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text-primary tracking-tight">
                {t("app.name")}
              </h1>
              <p className="text-[10px] text-text-muted">{t("app.tagline")}</p>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5 px-3 mt-1 flex-1 overflow-y-auto">
            {SIDEBAR_SECTIONS.map((section) => {
              const isCollapsed = collapsedSections[section.titleKey] ?? false;
              const hasActiveTab = section.tabs.some((tab) => tab.id === activeTab);
              return (
                <div key={section.titleKey} className="mb-1">
                  <button
                    onClick={() => toggleSection(section.titleKey)}
                    className="flex w-full items-center justify-between px-3 pt-3 pb-1.5 cursor-pointer group"
                  >
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest transition-colors",
                      hasActiveTab && !isCollapsed ? "text-accent/70" : "text-text-muted group-hover:text-text-secondary"
                    )}>
                      {t(section.titleKey)}
                    </span>
                    <ChevronDown className={cn(
                      "h-3 w-3 text-text-muted transition-transform duration-200",
                      isCollapsed && "-rotate-90"
                    )} />
                  </button>
                  {!isCollapsed && section.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer w-full",
                          isActive
                            ? "bg-accent/15 text-white border-l-[3px] border-accent"
                            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-[3px] border-transparent"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5", isActive && "text-accent")} />
                        {t(tab.labelKey)}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="px-3 py-3 space-y-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-all cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              {t("settings.title")}
            </button>
            <div className="rounded-xl border border-glass-border bg-surface-card/50 px-3 py-2">
              <p className="text-[10px] text-text-muted leading-relaxed">
                {t("sidebar.hint")}
              </p>
              {appVersion && <p className="text-[9px] text-text-muted/60 mt-1">v{appVersion}</p>}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: '#09090F' }}>
          <div className="mx-auto max-w-xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary">
                {t(TAB_LABEL_KEYS[activeTab])}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                {t(TAB_DESC_KEYS[activeTab])}
              </p>
            </div>

            {activeTab === "compress" && <CompressTab />}
            {activeTab === "convert" && <ConvertTab />}
            {activeTab === "resize" && <ResizeTab />}
            {activeTab === "crop" && <CropTab />}
            {activeTab === "optimize" && <OptimizeTab />}
            {activeTab === "watermark" && <WatermarkTab />}
            {activeTab === "strip" && <ExifStripTab />}
            {activeTab === "pdf" && <PdfTab />}
            {activeTab === "pdf-builder" && <PdfBuilderTab />}
            {activeTab === "pdf-to-images" && <PdfToImagesTab />}
            {activeTab === "pdf-split" && <PdfSplitTab />}
            {activeTab === "palette" && <PaletteTab />}
            {activeTab === "pdf-compress" && <PdfCompressTab />}
            {activeTab === "favicon" && <FaviconTab />}
            {activeTab === "animation" && <AnimationTab />}
            {activeTab === "spritesheet" && <SpriteSheetTab />}
            {activeTab === "pdf-protect" && <PdfProtectTab />}
            {activeTab === "base64" && <Base64Tab />}
            {activeTab === "qrcode" && <QrCodeTab />}
            {activeTab === "bulk-rename" && <BulkRenameTab />}
          </div>
        </main>
      </div>

      <SplashScreen visible={isLoading} />
      <GlobalProgressBar />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onResetOnboarding={() => { setShowSettings(false); setShowOnboarding(true); }} />}
      {showOnboarding && <OnboardingModal onComplete={() => { setShowOnboarding(false); try { localStorage.setItem("rustine_onboarded", "1"); } catch {} }} />}

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(108,108,237,0.08)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(108,108,237,0.15)',
            borderRadius: '12px',
            color: 'rgba(255,255,255,0.92)',
            fontSize: '12px',
            boxShadow: '0 0 20px rgba(108,108,237,0.1)',
          },
        }}
      />
    </div>
  );
}

export default App;
