import { memo, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface GlassModalProps {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")";

export const GlassModal = memo(function GlassModal({ children, className, maxWidth = "max-w-md" }: GlassModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-black/8 dark:border-white/8 bg-white/90 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-6",
          maxWidth,
          className,
        )}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: NOISE_SVG }}
        />
        {children}
      </div>
    </div>
  );
});
