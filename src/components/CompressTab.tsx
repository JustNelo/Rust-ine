import { useState, useCallback } from "react";
import { Zap } from "lucide-react";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { Slider } from "./ui/Slider";
import { useTabProcessor } from "../hooks/useTabProcessor";
import { useT } from "../i18n/i18n";

export function CompressTab() {
  const { t } = useT();
  const {
    files, removeFile, handleFilesSelected, handleClearFiles,
    loading, results, process,
  } = useTabProcessor({ tabId: "compress", command: "compress_webp" });
  const [quality, setQuality] = useState(80);

  const handleCompress = useCallback(async () => {
    await process({
      extraParams: { quality },
      successMessage: t("toast.compress_success", { n: files.length }),
      errorPrefix: t("status.compressing"),
    });
  }, [process, quality, files.length, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,bmp,ico,tiff,tif,webp"
        label={t("dropzone.images_compress")}
        sublabel={t("dropzone.sublabel_compress")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <Slider
        label={t("label.quality")}
        value={quality}
        min={1}
        max={100}
        leftHint={t("label.smaller_file")}
        rightHint={t("label.higher_quality")}
        onChange={setQuality}
      />

      <ActionButton
        onClick={handleCompress}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.compressing")}
        text={files.length > 0 ? t("action.compress_n", { n: files.length }) : t("action.compress")}
        icon={<Zap className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
