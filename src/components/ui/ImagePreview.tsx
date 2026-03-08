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
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: 12, border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}
    >
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
