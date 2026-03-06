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
  Settings,
  Sparkles,
  Crop,
  ChevronDown,
  Pipette,
  Globe,
  Film,
  LayoutGrid,
  Code,
  QrCode,
  PenLine,
  FileImage,
  Clock,
} from "lucide-react";
import { cn } from "./lib/utils";
import { TitleBar } from "./components/TitleBar";
import { CompressTab } from "./components/CompressTab";
import { ConvertTab } from "./components/ConvertTab";
import { ResizeTab } from "./components/ResizeTab";
import { WatermarkTab } from "./components/WatermarkTab";
import { ExifStripTab } from "./components/ExifStripTab";
import { OptimizeTab } from "./components/OptimizeTab";
import { CropTab } from "./components/CropTab";
import { PdfWorkbenchTab } from "./components/PdfWorkbenchTab";
import { PaletteTab } from "./components/PaletteTab";
import { FaviconTab } from "./components/FaviconTab";
import { AnimationTab } from "./components/AnimationTab";
import { SpriteSheetTab } from "./components/SpriteSheetTab";
import { Base64Tab } from "./components/Base64Tab";
import { QrCodeTab } from "./components/QrCodeTab";
import { BulkRenameTab } from "./components/BulkRenameTab";
import { SvgRasterizeTab } from "./components/SvgRasterizeTab";
import { HistoryModal } from "./components/HistoryModal";
import { GlobalProgressBar } from "./components/GlobalProgressBar";
import { SplashScreen } from "./components/SplashScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { OnboardingModal } from "./components/OnboardingModal";
import { UpdateBanner } from "./components/UpdateBanner";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { useTheme } from "./hooks/useTheme";
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
  "pdf-toolkit": ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf"],
  palette: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  favicon: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  animation: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  spritesheet: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  base64: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "tiff", "tif"],
  qrcode: [],
  "bulk-rename": ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp", "gif", "ico", "svg"],
  "svg-rasterize": ["svg"],
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
      { id: "svg-rasterize", labelKey: "tab.svg_rasterize", icon: FileImage },
    ],
  },
  {
    titleKey: "section.pdf_tools",
    tabs: [{ id: "pdf-toolkit", labelKey: "tab.pdf_toolkit", icon: FileDown }],
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
  "pdf-toolkit": "tab.pdf_toolkit.desc",
  palette: "tab.palette.desc",
  favicon: "tab.favicon.desc",
  animation: "tab.animation.desc",
  spritesheet: "tab.spritesheet.desc",
  base64: "tab.base64.desc",
  qrcode: "tab.qrcode.desc",
  "bulk-rename": "tab.bulk_rename.desc",
  "svg-rasterize": "tab.svg_rasterize.desc",
};

const TAB_LABEL_KEYS: Record<TabId, string> = {
  compress: "tab.compress",
  convert: "tab.convert",
  resize: "tab.resize",
  watermark: "tab.watermark",
  strip: "tab.strip",
  optimize: "tab.optimize",
  crop: "tab.crop",
  "pdf-toolkit": "tab.pdf_toolkit",
  palette: "tab.palette",
  favicon: "tab.favicon",
  animation: "tab.animation",
  spritesheet: "tab.spritesheet",
  base64: "tab.base64",
  qrcode: "tab.qrcode",
  "bulk-rename": "tab.bulk_rename",
  "svg-rasterize": "tab.svg_rasterize",
};

function App() {
  const { t } = useT();
  const {
    status: updateStatus,
    version: updateVersion,
    install: installUpdate,
    dismiss: dismissUpdate,
  } = useAutoUpdate();
  const { theme } = useTheme();
  const [appVersion, setAppVersion] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("compress");
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem("rustine_onboarded") !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  const activeExtensions = useMemo(() => TAB_EXTENSIONS[activeTab], [activeTab]);

  const handleShortcutFiles = useCallback((paths: string[]) => {
    // Dispatch a custom event that tab components can listen to
    window.dispatchEvent(new CustomEvent("rustine-shortcut-files", { detail: paths }));
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
      {/* ── Ambient background blobs ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-125 w-125 rounded-full bg-indigo-200 dark:bg-indigo-900 mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-25 dark:opacity-30" />
        <div className="absolute top-1/2 right-[-10%] h-100 w-100 rounded-full bg-neutral-300 dark:bg-neutral-800 mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-15 dark:opacity-20" />
        <div className="absolute bottom-[-15%] left-1/3 h-87.5 w-87.5 rounded-full bg-indigo-200 dark:bg-indigo-900 mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-15 dark:opacity-20" />
      </div>

      <TitleBar />
      <UpdateBanner status={updateStatus} version={updateVersion} onInstall={installUpdate} onDismiss={dismissUpdate} />

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-indigo-400/10 bg-white/80 dark:bg-white/2 backdrop-blur-xl">
          <nav className="flex flex-col gap-0.5 px-3 mt-1 flex-1 overflow-y-auto">
            {SIDEBAR_SECTIONS.map((section) => {
              const isCollapsed = collapsedSections[section.titleKey] ?? false;
              return (
                <div key={section.titleKey} className="mb-1">
                  <button
                    onClick={() => toggleSection(section.titleKey)}
                    className="flex w-full items-center justify-between px-3 pt-3 pb-1.5 cursor-pointer group"
                  >
                    <span className="text-[9px] font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500 transition-colors group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
                      {t(section.titleKey)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-neutral-400 dark:text-neutral-600 transition-transform duration-200",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                  {!isCollapsed &&
                    section.tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer w-full",
                            isActive
                              ? "bg-indigo-500/15 text-indigo-900 dark:text-white border-l-2 border-indigo-400"
                              : "text-neutral-500 dark:text-neutral-400 hover:bg-black/4 dark:hover:bg-white/4 hover:text-neutral-800 dark:hover:text-neutral-200 border-l-2 border-transparent",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5",
                              isActive
                                ? "text-indigo-500 dark:text-indigo-400"
                                : "text-neutral-400 dark:text-neutral-500",
                            )}
                            strokeWidth={1.5}
                          />
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
              onClick={() => setShowHistory(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:bg-black/4 dark:hover:bg-white/4 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all duration-200 cursor-pointer"
            >
              <Clock className="h-4 w-4" strokeWidth={1.5} />
              {t("history.title")}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:bg-black/4 dark:hover:bg-white/4 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all duration-200 cursor-pointer"
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
              {t("settings.title")}
            </button>
            <div className="relative overflow-hidden rounded-xl border border-black/12 dark:border-white/8 bg-black/4 dark:bg-white/2 px-3 py-2">
              <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/25 to-transparent" />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed">{t("sidebar.hint")}</p>
              {appVersion && <p className="text-[9px] text-neutral-400 dark:text-neutral-600 mt-1">v{appVersion}</p>}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-transparent">
          <div className="mx-auto max-w-xl">
            <div className="mb-6">
              <h2 className="text-lg font-light text-neutral-900 dark:text-white">{t(TAB_LABEL_KEYS[activeTab])}</h2>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{t(TAB_DESC_KEYS[activeTab])}</p>
            </div>

            {activeTab === "compress" && <CompressTab />}
            {activeTab === "convert" && <ConvertTab />}
            {activeTab === "resize" && <ResizeTab />}
            {activeTab === "crop" && <CropTab />}
            {activeTab === "optimize" && <OptimizeTab />}
            {activeTab === "watermark" && <WatermarkTab />}
            {activeTab === "strip" && <ExifStripTab />}
            {activeTab === "pdf-toolkit" && <PdfWorkbenchTab />}
            {activeTab === "palette" && <PaletteTab />}
            {activeTab === "favicon" && <FaviconTab />}
            {activeTab === "animation" && <AnimationTab />}
            {activeTab === "spritesheet" && <SpriteSheetTab />}
            {activeTab === "base64" && <Base64Tab />}
            {activeTab === "qrcode" && <QrCodeTab />}
            {activeTab === "bulk-rename" && <BulkRenameTab />}
            {activeTab === "svg-rasterize" && <SvgRasterizeTab />}
          </div>
        </main>
      </div>

      <SplashScreen visible={isLoading} />
      <GlobalProgressBar />

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onResetOnboarding={() => {
            setShowSettings(false);
            setShowOnboarding(true);
          }}
        />
      )}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false);
            try {
              localStorage.setItem("rustine_onboarded", "1");
            } catch {}
          }}
        />
      )}

      <Toaster
        position="bottom-right"
        theme={theme === "dark" ? "dark" : "light"}
        toastOptions={{
          style: {
            background: theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.9)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: theme === "dark" ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(99,102,241,0.15)",
            borderRadius: "16px",
            color: theme === "dark" ? "#ffffff" : "#1a1a1a",
            fontSize: "12px",
            boxShadow: theme === "dark" ? "0 8px 32px 0 rgba(0,0,0,0.3)" : "0 8px 32px 0 rgba(0,0,0,0.1)",
          },
        }}
      />
    </div>
  );
}

export default App;
