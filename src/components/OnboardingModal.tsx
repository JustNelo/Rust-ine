import { useState } from "react";
import {
  ChevronRight, ChevronLeft, FolderOpen,
  Zap, ArrowRightLeft, Scaling, Stamp, ShieldOff,
  FileDown, FileUp, Sparkles, Crop, Pipette,
  Image, Scissors, FileArchive, Lock,
  Globe, Film, LayoutGrid, Code, QrCode, PenLine,
} from "lucide-react";
import { useT, type Lang } from "../i18n/i18n";
import { useWorkspace } from "../hooks/useWorkspace";
import appIcon from "../assets/icon.png";

interface OnboardingModalProps {
  onComplete: () => void;
}

interface FeatureSection {
  titleKey: string;
  features: { icon: typeof Zap; key: string }[];
}

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    titleKey: "onboarding.section_images",
    features: [
      { icon: Zap, key: "onboarding.feature_compress" },
      { icon: ArrowRightLeft, key: "onboarding.feature_convert" },
      { icon: Scaling, key: "onboarding.feature_resize" },
      { icon: Crop, key: "onboarding.feature_crop" },
      { icon: Sparkles, key: "onboarding.feature_optimize" },
      { icon: Stamp, key: "onboarding.feature_watermark" },
      { icon: ShieldOff, key: "onboarding.feature_strip" },
      { icon: Pipette, key: "onboarding.feature_palette" },
    ],
  },
  {
    titleKey: "onboarding.section_pdf",
    features: [
      { icon: FileDown, key: "onboarding.feature_extract" },
      { icon: FileUp, key: "onboarding.feature_builder" },
      { icon: Image, key: "onboarding.feature_pdf_to_images" },
      { icon: Scissors, key: "onboarding.feature_pdf_split" },
      { icon: FileArchive, key: "onboarding.feature_pdf_compress" },
      { icon: Lock, key: "onboarding.feature_pdf_protect" },
    ],
  },
  {
    titleKey: "onboarding.section_dev",
    features: [
      { icon: Globe, key: "onboarding.feature_favicon" },
      { icon: Film, key: "onboarding.feature_animation" },
      { icon: LayoutGrid, key: "onboarding.feature_spritesheet" },
      { icon: Code, key: "onboarding.feature_base64" },
      { icon: QrCode, key: "onboarding.feature_qrcode" },
      { icon: PenLine, key: "onboarding.feature_bulk_rename" },
    ],
  },
];

const FOLDER_GROUPS = [
  {
    titleKey: "onboarding.section_images",
    folders: ["compressed/", "converted/", "resized/", "cropped/", "optimized/", "watermarked/", "stripped/", "palettes/"],
  },
  {
    titleKey: "onboarding.section_pdf",
    folders: ["pdf-extracted/", "pdf-built/", "pdf-pages/", "pdf-split/", "pdf-compressed/", "pdf-protected/"],
  },
  {
    titleKey: "onboarding.section_dev",
    folders: ["favicons/", "animations/", "spritesheets/", "base64/", "qrcodes/", "renamed/"],
  },
];

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { lang, setLang, t } = useT();
  const { workspace, selectWorkspace } = useWorkspace();
  const [step, setStep] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-glass-border bg-background p-8 shadow-[0_0_60px_rgba(108,108,237,0.2)]">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-accent" : "w-1.5 bg-accent/20"
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome + Language */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl" />
              <img src={appIcon} alt="Rust-ine" className="relative h-16 w-16" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">{t("onboarding.welcome")}</h2>
            <p className="mt-2 text-sm text-text-muted max-w-xs">{t("onboarding.welcome_sub")}</p>

            <div className="mt-8 w-full max-w-xs">
              <p className="text-xs font-medium text-text-secondary mb-3">{t("onboarding.language")}</p>
              <div className="flex gap-2">
                {(["en", "fr"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                      lang === l
                        ? "bg-accent text-white shadow-[0_0_16px_rgba(108,108,237,0.35)]"
                        : "bg-surface-card text-text-secondary hover:bg-surface-hover border border-border"
                    }`}
                  >
                    {l === "en" ? "🇬🇧 English" : "🇫🇷 Français"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Workspace */}
        {step === 1 && (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 mb-5">
              <FolderOpen className="h-7 w-7 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">{t("onboarding.workspace_title")}</h2>
            <p className="mt-2 text-sm text-text-muted max-w-sm">{t("onboarding.workspace_sub")}</p>

            <div className="mt-6 w-full max-w-xs">
              {workspace ? (
                <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                  <p className="text-xs text-text-primary truncate">{workspace}</p>
                  <button
                    onClick={selectWorkspace}
                    className="mt-2 text-[10px] text-accent hover:text-accent-hover transition-colors cursor-pointer"
                  >
                    {t("settings.change")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={selectWorkspace}
                  className="w-full rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 px-4 py-4 text-sm text-accent hover:border-accent/50 hover:bg-accent/10 transition-all cursor-pointer"
                >
                  {t("onboarding.choose_folder")}
                </button>
              )}
            </div>

            <div className="mt-5 w-full max-w-sm text-left">
              <p className="text-[10px] text-text-muted mb-1.5 font-medium">{t("onboarding.folders_auto")}</p>
              <div className="rounded-lg bg-surface-card border border-border px-3 py-2.5 space-y-2 max-h-40 overflow-y-auto">
                {FOLDER_GROUPS.map((group) => (
                  <div key={group.titleKey}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-accent/60 mb-0.5">{t(group.titleKey)}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      {group.folders.map((folder) => (
                        <p key={folder} className="text-[10px] text-text-muted font-mono truncate">📁 {folder}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Ready — features grouped by section */}
        {step === 2 && (
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-text-primary">{t("onboarding.ready_title")}</h2>
            <p className="mt-2 text-sm text-text-muted">{t("onboarding.ready_sub")}</p>

            <div className="mt-5 w-full max-w-sm space-y-3 max-h-64 overflow-y-auto">
              {FEATURE_SECTIONS.map((section) => (
                <div key={section.titleKey}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-accent/60 mb-1 text-left px-1">{t(section.titleKey)}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {section.features.map((f) => {
                      const Icon = f.icon;
                      return (
                        <div key={f.key} className="flex items-center gap-2 rounded-lg bg-surface-card px-2.5 py-1.5">
                          <Icon className="h-3.5 w-3.5 text-accent shrink-0" />
                          <span className="text-[11px] text-text-primary truncate">{t(f.key)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("onboarding.back")}
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 rounded-lg bg-accent px-5 py-2 text-xs font-medium text-white shadow-[0_0_16px_rgba(108,108,237,0.3)] hover:bg-accent-hover transition-all cursor-pointer"
            >
              {t("onboarding.next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1 rounded-lg bg-accent px-5 py-2.5 text-xs font-medium text-white shadow-[0_0_16px_rgba(108,108,237,0.3)] hover:bg-accent-hover transition-all cursor-pointer"
            >
              {t("onboarding.lets_go")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
