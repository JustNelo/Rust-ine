import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Loader2,
  ShieldOff,
  Camera,
  MapPin,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { ActionButton } from "./ui/ActionButton";
import { formatSize } from "../lib/utils";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ResultsBanner } from "./ResultsBanner";
import { useTabProcessor } from "../hooks/useTabProcessor";
import { useT } from "../i18n/i18n";
import type { ImageMetadata } from "../types";

function MetadataPanel({ metadata }: { metadata: ImageMetadata }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(true);
  const fileName = metadata.path.split(/[\\/]/).pop() || "";

  const gpsEntries = metadata.exif.filter((e) =>
    e.tag.startsWith("GPS")
  );
  const cameraEntries = metadata.exif.filter(
    (e) =>
      ["Camera Make", "Camera Model", "Lens Model", "Software"].includes(e.tag)
  );
  const shootingEntries = metadata.exif.filter(
    (e) =>
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
      ].includes(e.tag)
  );
  const otherEntries = metadata.exif.filter(
    (e) =>
      !gpsEntries.includes(e) &&
      !cameraEntries.includes(e) &&
      !shootingEntries.includes(e)
  );

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/4 transition-colors duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-3.5 w-3.5 text-neutral-400 shrink-0" strokeWidth={1.5} />
          <span className="text-xs font-medium text-white truncate">
            {fileName}
          </span>
          <span className="text-[10px] text-neutral-500 shrink-0">
            {metadata.width}×{metadata.height} · {metadata.format} ·{" "}
            {formatSize(metadata.file_size)}
          </span>
          {metadata.exif.length > 0 ? (
            <span className="text-[10px] font-medium text-neutral-300 shrink-0">
              {t("exif.n_fields", { n: metadata.exif.length })}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-neutral-500 shrink-0">
              {t("exif.no_metadata")}
            </span>
          )}
        </div>
        {metadata.exif.length > 0 &&
          (expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-500 shrink-0" strokeWidth={1.5} />
          ))}
      </button>

      {expanded && metadata.exif.length > 0 && (
        <div className="border-t border-white/8 px-3 py-2 space-y-3">
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
                    <span className="text-[10px] text-white font-mono text-right truncate">
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
                    <span className="text-[10px] text-white font-mono text-right truncate">
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
                    <span className="text-[10px] text-neutral-300 font-mono text-right truncate">
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
                    <span className="text-[10px] text-white font-mono text-right truncate">
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExifStripTab() {
  const { t } = useT();
  const {
    files, removeFile, reorderFiles, handleFilesSelected, handleClearFiles: baseClear,
    loading, results, lastOutputDir, process,
  } = useTabProcessor({ tabId: "strip", command: "strip_metadata" });
  const [metadataList, setMetadataList] = useState<ImageMetadata[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const handleClearFiles = useCallback(() => {
    baseClear();
    setMetadataList([]);
  }, [baseClear]);

  useEffect(() => {
    if (files.length === 0) {
      setMetadataList([]);
      return;
    }

    let cancelled = false;
    setLoadingMeta(true);

    (async () => {
      const results: ImageMetadata[] = [];
      for (const file of files) {
        if (cancelled) break;
        try {
          const meta = await invoke<ImageMetadata>("read_metadata", {
            filePath: file,
          });
          results.push(meta);
        } catch {
          // skip files that can't be read
        }
      }
      if (!cancelled) {
        setMetadataList(results);
        setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files]);

  const totalExifFields = metadataList.reduce(
    (acc, m) => acc + m.exif.length,
    0
  );
  const hasGps = metadataList.some((m) =>
    m.exif.some((e) => e.tag.startsWith("GPS"))
  );

  const handleStrip = useCallback(async () => {
    await process({
      successMessage: t("toast.strip_success", { n: files.length }),
      errorPrefix: t("status.stripping"),
    });
  }, [process, files.length, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,tiff,tif,webp"
        label={t("dropzone.images_strip")}
        sublabel={t("dropzone.sublabel_strip")}
        onFilesSelected={handleFilesSelected}
      />

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              {t("label.metadata_inspector")}
            </span>
            {loadingMeta ? (
              <span className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                {t("status.scanning")}
              </span>
            ) : (
              <div className="flex items-center gap-3">
                {totalExifFields > 0 && (
                  <span className="text-[10px] font-medium text-neutral-300">
                    {t("result.fields_found", { n: totalExifFields })}
                  </span>
                )}
                {hasGps && (
                  <span className="flex items-center gap-1 text-[10px] text-neutral-300 font-medium">
                    <MapPin className="h-3 w-3" strokeWidth={1.5} />
                    {t("result.gps_detected")}
                  </span>
                )}
                {totalExifFields === 0 && (
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {t("result.clean")}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {metadataList.map((meta) => (
              <MetadataPanel key={meta.path} metadata={meta} />
            ))}
          </div>
        </div>
      )}

      <ActionButton
        onClick={handleStrip}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.stripping")}
        text={files.length > 0 ? t("action.strip_n", { n: files.length }) : t("action.strip")}
        icon={<ShieldOff className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} outputDir={lastOutputDir} />
    </div>
  );
}
