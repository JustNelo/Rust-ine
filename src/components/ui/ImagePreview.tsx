import { memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ImagePreviewProps {
  path: string;
  className?: string;
  overlay?: React.ReactNode;
}

export const ImagePreview = memo(function ImagePreview({ path, className = "", overlay }: ImagePreviewProps) {
  if (!path) return null;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-glass-border bg-surface ${className}`}>
      <img
        src={`${convertFileSrc(path)}?t=${Date.now()}`}
        alt=""
        className="w-full h-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {overlay}
    </div>
  );
});
