import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, ShieldOff, MapPin } from "lucide-react";
import { ActionButton } from "./ui/ActionButton";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ResultsBanner } from "./ResultsBanner";
import { MetadataPanel } from "./MetadataPanel";
import { useTabProcessor } from "../hooks/useTabProcessor";
import { useT } from "../i18n/i18n";
import type { ImageMetadata } from "../types";

export function ExifStripTab() {
  const { t } = useT();
  const {
    files,
    removeFile,
    reorderFiles,
    handleFilesSelected,
    handleClearFiles: baseClear,
    loading,
    results,
    lastOutputDir,
    process,
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

  const totalExifFields = metadataList.reduce((acc, m) => acc + m.exif.length, 0);
  const hasGps = metadataList.some((m) => m.exif.some((e) => e.tag.startsWith("GPS")));

  const handleStrip = useCallback(async () => {
    await process({
      successMessage: t("toast.strip_success", { n: files.length }),
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
                  <span className="text-[10px] text-neutral-500 font-medium">{t("result.clean")}</span>
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
