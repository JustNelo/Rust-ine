import { memo } from "react";
import { safeAssetUrl } from "../../lib/utils";

interface ImagePreviewProps {
  path: string;
  className?: string;
  overlay?: React.ReactNode;
}

export const ImagePreview = memo(function ImagePreview({ path, className = "", overlay }: ImagePreviewProps) {
  if (!path) return null;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-black/12 dark:border-white/8 bg-black/4 dark:bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] ${className}`}>
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
      <img
        src={safeAssetUrl(path, true)}
        alt=""
        className="relative w-full h-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {overlay}
    </div>
  );
});
