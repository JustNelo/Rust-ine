import appIcon from "../assets/icon.png";
import { useT } from "../i18n/i18n";

interface SplashScreenProps {
  visible: boolean;
}

export function SplashScreen({ visible }: SplashScreenProps) {
  const { t } = useT();
  return (
    <div
      className={`fixed inset-0 z-100 flex flex-col items-center justify-center bg-white dark:bg-neutral-950 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-indigo-300 dark:bg-indigo-900 blur-xl opacity-30 animate-pulse" />
          <img
            src={appIcon}
            alt="Rust-ine"
            className="relative h-20 w-20 animate-[spin_3s_linear_infinite]"
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">
            {t("app.name")}
          </h1>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {t("app.tagline")}
          </p>
        </div>
        <div className="w-32 h-1 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden mt-2">
          <div className="h-full w-full rounded-full bg-indigo-400 animate-[loading_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
