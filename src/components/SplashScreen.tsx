import appIcon from "../assets/icon.png";

interface SplashScreenProps {
  visible: boolean;
}

export function SplashScreen({ visible }: SplashScreenProps) {
  return (
    <div
      className={`fixed inset-0 z-100 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl animate-pulse" />
          <img
            src={appIcon}
            alt="Rust-ine"
            className="relative h-20 w-20 animate-[spin_3s_linear_infinite]"
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Rust-ine
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Image & PDF Swiss Army Knife
          </p>
        </div>
        <div className="w-32 h-1 rounded-full bg-accent-muted overflow-hidden mt-2">
          <div className="h-full w-full rounded-full bg-accent animate-[loading_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
