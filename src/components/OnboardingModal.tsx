import { useState } from "react";
import {
  ChevronRight, ChevronLeft, FolderOpen,
  Zap, ArrowRightLeft, Scaling, Stamp, ShieldOff,
  FileDown, Sparkles, Crop, Pipette,
  Globe, Film, LayoutGrid, Code, QrCode, PenLine,
} from "lucide-react";
import { useT, type Lang } from "../i18n/i18n";
import { useWorkspace } from "../hooks/useWorkspace";
import { GlassModal } from "./ui/GlassModal";
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
      { icon: FileDown, key: "onboarding.feature_pdf_toolkit" },
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
    folders: ["pdf-toolkit/"],
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
    <GlassModal maxWidth="max-w-lg" className="rounded-3xl p-8">
        {/* Step indicators */}
        <div className="relative flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-indigo-400" : "w-1.5 bg-black/20 dark:bg-white/15"
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome + Language */}
        {step === 0 && (
          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-indigo-900 blur-xl opacity-30" />
              <img src={appIcon} alt="Rust-ine" className="relative h-16 w-16" />
            </div>
            <h2 className="text-xl font-light text-neutral-900 dark:text-white">{t("onboarding.welcome")}</h2>
            <p className="mt-2 text-sm text-neutral-500 max-w-xs">{t("onboarding.welcome_sub")}</p>

            <div className="mt-8 w-full max-w-xs">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-3">{t("onboarding.language")}</p>
              <div className="flex gap-2">
                {(["en", "fr"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300 cursor-pointer ${
                      lang === l
                        ? "bg-indigo-500/15 dark:bg-neutral-100 text-indigo-600 dark:text-neutral-900 border border-indigo-500/40 dark:border-transparent shadow-[0_0_20px_rgba(99,102,241,0.35)]"
                        : "bg-black/6 dark:bg-white/5 border border-black/12 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20"
                    }`}
                  >
                    {l === "en" ? "English" : "Français"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Workspace */}
        {step === 1 && (
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/8 dark:bg-white/6 mb-5">
              <FolderOpen className="h-7 w-7 text-neutral-500 dark:text-neutral-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-light text-neutral-900 dark:text-white">{t("onboarding.workspace_title")}</h2>
            <p className="mt-2 text-sm text-neutral-500 max-w-sm">{t("onboarding.workspace_sub")}</p>

            <div className="mt-6 w-full max-w-xs">
              {workspace ? (
                <div className="rounded-lg border border-black/12 dark:border-white/10 bg-black/6 dark:bg-white/4 px-4 py-3">
                  <p className="text-xs text-neutral-900 dark:text-white truncate">{workspace}</p>
                  <button
                    onClick={selectWorkspace}
                    className="mt-2 text-[10px] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors duration-200 cursor-pointer"
                  >
                    {t("settings.change")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={selectWorkspace}
                  className="w-full rounded-lg border-2 border-dashed border-black/20 dark:border-white/15 bg-black/5 dark:bg-white/3 px-4 py-4 text-sm text-neutral-700 dark:text-neutral-300 hover:border-black/30 dark:hover:border-white/25 hover:bg-black/8 dark:hover:bg-white/5 transition-all duration-300 cursor-pointer"
                >
                  {t("onboarding.choose_folder")}
                </button>
              )}
            </div>

            <div className="mt-5 w-full max-w-sm text-left">
              <p className="text-[10px] text-neutral-500 mb-1.5 font-medium">{t("onboarding.folders_auto")}</p>
              <div className="rounded-lg bg-black/5 dark:bg-white/3 border border-black/12 dark:border-white/8 px-3 py-2.5 space-y-2 max-h-40 overflow-y-auto">
                {FOLDER_GROUPS.map((group) => (
                  <div key={group.titleKey}>
                    <p className="text-[9px] font-medium uppercase tracking-widest text-neutral-500 mb-0.5">{t(group.titleKey)}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      {group.folders.map((folder) => (
                        <p key={folder} className="text-[10px] text-neutral-500 font-mono truncate">{folder}</p>
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
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/8 dark:bg-white/6 mb-4">
              <Zap className="h-6 w-6 text-neutral-900 dark:text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-light text-neutral-900 dark:text-white">{t("onboarding.ready_title")}</h2>
            <p className="mt-2 text-sm text-neutral-500">{t("onboarding.ready_sub")}</p>

            <div className="mt-5 w-full max-w-sm space-y-3 max-h-64 overflow-y-auto">
              {FEATURE_SECTIONS.map((section) => (
                <div key={section.titleKey}>
                  <p className="text-[9px] font-medium uppercase tracking-widest text-neutral-500 mb-1 text-left px-1">{t(section.titleKey)}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {section.features.map((f) => {
                      const Icon = f.icon;
                      return (
                        <div key={f.key} className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/3 border border-black/10 dark:border-white/6 px-2.5 py-1.5">
                          <Icon className="h-3.5 w-3.5 text-indigo-400/60 shrink-0" strokeWidth={1.5} />
                          <span className="text-[11px] text-neutral-700 dark:text-neutral-200 truncate">{t(f.key)}</span>
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
        <div className="relative flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/4 transition-all duration-200 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("onboarding.back")}
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 rounded-lg bg-indigo-500 dark:bg-neutral-100 px-5 py-2 text-xs font-medium text-white dark:text-neutral-900 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:bg-indigo-600 dark:hover:bg-white transition-all duration-300 cursor-pointer"
            >
              {t("onboarding.next")}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1 rounded-lg bg-indigo-500 dark:bg-neutral-100 px-5 py-2.5 text-xs font-medium text-white dark:text-neutral-900 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:bg-indigo-600 dark:hover:bg-white transition-all duration-300 cursor-pointer"
            >
              {t("onboarding.lets_go")}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
    </GlassModal>
  );
}
