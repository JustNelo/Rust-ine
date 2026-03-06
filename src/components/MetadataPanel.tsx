import { useState } from "react";
import { Camera, MapPin, Info, ChevronDown, ChevronUp, Eye, Monitor } from "lucide-react";
import { formatSize } from "../lib/utils";
import { useT } from "../i18n/i18n";
import type { ImageMetadata } from "../types";

export function MetadataPanel({ metadata }: { metadata: ImageMetadata }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(true);
  const fileName = metadata.path.split(/[\\/]/).pop() || "";

  const gpsEntries = metadata.exif.filter((e) => e.tag.startsWith("GPS"));
  const cameraEntries = metadata.exif.filter((e) =>
    ["Camera Make", "Camera Model", "Lens Model", "Software"].includes(e.tag),
  );
  const shootingEntries = metadata.exif.filter((e) =>
    [
      "Exposure Time",
      "F-Number",
      "ISO Speed",
      "Focal Length",
      "Focal Length (35mm)",
      "Flash",
      "Metering Mode",
      "White Balance",
      "Exposure Mode",
    ].includes(e.tag),
  );
  const otherEntries = metadata.exif.filter(
    (e) => !gpsEntries.includes(e) && !cameraEntries.includes(e) && !shootingEntries.includes(e),
  );

  const hasDetails = metadata.bit_depth || metadata.color_type || metadata.dpi;

  return (
    <div className="rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 backdrop-blur-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-black/4 dark:hover:bg-white/4 transition-colors duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-3.5 w-3.5 text-neutral-400 shrink-0" strokeWidth={1.5} />
          <span className="text-xs font-medium text-neutral-900 dark:text-white truncate">{fileName}</span>
          <span className="text-[10px] text-neutral-500 shrink-0">
            {metadata.width}×{metadata.height} · {metadata.format} · {formatSize(metadata.file_size)}
          </span>
          {metadata.exif.length > 0 ? (
            <span className="text-[10px] font-medium text-neutral-300 shrink-0">
              {t("exif.n_fields", { n: metadata.exif.length })}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-neutral-500 shrink-0">{t("exif.no_metadata")}</span>
          )}
        </div>
        {(metadata.exif.length > 0 || hasDetails) &&
          (expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.5} />
          ))}
      </button>

      {expanded && (
        <div className="border-t border-black/8 dark:border-white/8 px-3 py-2 space-y-3">
          {/* Image details: bit depth, color type, DPI */}
          {hasDetails && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Monitor className="h-3 w-3 text-neutral-500" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                  {t("info.image_details")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {metadata.color_type && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{t("info.color_type")}</span>
                    <span className="text-[10px] text-neutral-900 dark:text-white font-mono text-right truncate">
                      {metadata.color_type}
                    </span>
                  </div>
                )}
                {metadata.bit_depth && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{t("info.bit_depth")}</span>
                    <span className="text-[10px] text-neutral-900 dark:text-white font-mono text-right truncate">
                      {metadata.bit_depth} bit
                    </span>
                  </div>
                )}
                {metadata.dpi && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{t("info.dpi")}</span>
                    <span className="text-[10px] text-neutral-900 dark:text-white font-mono text-right truncate">
                      {metadata.dpi[0]}×{metadata.dpi[1]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {cameraEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Camera className="h-3 w-3 text-neutral-500" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                  {t("exif.camera")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {cameraEntries.map((e) => (
                  <div key={e.tag} className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{e.tag}</span>
                    <span className="text-[10px] text-neutral-900 dark:text-white font-mono text-right truncate">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shootingEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info className="h-3 w-3 text-neutral-500" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                  {t("exif.shooting")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {shootingEntries.map((e) => (
                  <div key={e.tag} className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{e.tag}</span>
                    <span className="text-[10px] text-neutral-900 dark:text-white font-mono text-right truncate">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gpsEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="h-3 w-3 text-neutral-400" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                  {t("exif.gps_location")}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-y-0.5">
                {gpsEntries.map((e) => (
                  <div key={e.tag} className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{e.tag}</span>
                    <span className="text-[10px] text-neutral-600 dark:text-neutral-300 font-mono text-right truncate">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info className="h-3 w-3 text-neutral-500" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
                  {t("exif.other")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {otherEntries.map((e) => (
                  <div key={e.tag} className="flex justify-between gap-2">
                    <span className="text-[10px] text-neutral-500">{e.tag}</span>
                    <span className="text-[10px] text-neutral-900 dark:text-white font-mono text-right truncate">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasDetails && metadata.exif.length === 0 && (
            <p className="text-[10px] text-neutral-500 text-center py-1">{t("exif.no_metadata")}</p>
          )}
        </div>
      )}
    </div>
  );
}
