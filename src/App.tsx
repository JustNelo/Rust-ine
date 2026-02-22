import { useState, useMemo, useCallback, useEffect } from "react";
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
import { PdfBuilderTab } from "./components/PdfBuilderTab";
import { GlobalProgressBar } from "./components/GlobalProgressBar";
import { SplashScreen } from "./components/SplashScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { OnboardingModal } from "./components/OnboardingModal";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useT } from "./i18n/i18n";
import type { TabId } from "./types";
import "./App.css";

const TAB_EXTENSIONS: Record<TabId, string[]> = {
  compress: ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp"],
  convert: ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "gif"],
  resize: ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "gif"],
  watermark: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  strip: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"],
  pdf: ["pdf"],
  "pdf-builder": ["png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf"],
};

const IMAGE_TABS: { id: TabId; labelKey: string; icon: typeof Zap }[] = [
  { id: "compress", labelKey: "tab.compress", icon: Zap },
  { id: "convert", labelKey: "tab.convert", icon: ArrowRightLeft },
  { id: "resize", labelKey: "tab.resize", icon: Scaling },
  { id: "watermark", labelKey: "tab.watermark", icon: Stamp },
  { id: "strip", labelKey: "tab.strip", icon: ShieldOff },
];

const PDF_TABS: { id: TabId; labelKey: string; icon: typeof Zap }[] = [
  { id: "pdf", labelKey: "tab.pdf", icon: FileDown },
  { id: "pdf-builder", labelKey: "tab.pdf_builder", icon: FileUp },
];

const TAB_DESC_KEYS: Record<TabId, string> = {
  compress: "tab.compress.desc",
  convert: "tab.convert.desc",
  resize: "tab.resize.desc",
  watermark: "tab.watermark.desc",
  strip: "tab.strip.desc",
  pdf: "tab.pdf.desc",
  "pdf-builder": "tab.pdf_builder.desc",
};

const TAB_LABEL_KEYS: Record<TabId, string> = {
  compress: "tab.compress",
  convert: "tab.convert",
  resize: "tab.resize",
  watermark: "tab.watermark",
  strip: "tab.strip",
  pdf: "tab.pdf",
  "pdf-builder": "tab.pdf_builder",
};

function App() {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<TabId>("compress");
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem("rustine_onboarded") !== "1"; } catch { return true; }
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const activeExtensions = useMemo(() => TAB_EXTENSIONS[activeTab], [activeTab]);

  const handleShortcutFiles = useCallback((paths: string[]) => {
    // Dispatch a custom event that tab components can listen to
    window.dispatchEvent(
      new CustomEvent("rustine-shortcut-files", { detail: paths })
    );
  }, []);

  useGlobalShortcuts({
    acceptExtensions: activeExtensions,
    onFilesSelected: handleShortcutFiles,
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />

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

          <nav className="flex flex-col gap-0.5 px-3 mt-1 flex-1">
            <span className="px-3 pt-2 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">
              {t("section.image_tools")}
            </span>
            {IMAGE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-accent/15 text-white border-l-[3px] border-accent"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-[3px] border-transparent"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive && "text-accent")} />
                  {t(tab.labelKey)}
                </button>
              );
            })}

            <span className="px-3 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">
              {t("section.pdf_tools")}
            </span>
            {PDF_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-accent/15 text-white border-l-[3px] border-accent"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-[3px] border-transparent"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive && "text-accent")} />
                  {t(tab.labelKey)}
                </button>
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
              <p className="text-[9px] text-text-muted/60 mt-1">{t("app.version")}</p>
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
            {activeTab === "watermark" && <WatermarkTab />}
            {activeTab === "strip" && <ExifStripTab />}
            {activeTab === "pdf" && <PdfTab />}
            {activeTab === "pdf-builder" && <PdfBuilderTab />}
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
