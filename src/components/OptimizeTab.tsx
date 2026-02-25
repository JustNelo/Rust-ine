import { useCallback } from "react";
import { Sparkles } from "lucide-react";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ResultsBanner } from "./ResultsBanner";
import { ActionButton } from "./ui/ActionButton";
import { useTabProcessor } from "../hooks/useTabProcessor";
import { useT } from "../i18n/i18n";

export function OptimizeTab() {
  const { t } = useT();
  const {
    files, removeFile, handleFilesSelected, handleClearFiles,
    loading, results, process,
  } = useTabProcessor({ tabId: "optimize", command: "optimize_images" });

  const handleOptimize = useCallback(async () => {
    await process({
      successMessage: t("toast.optimize_success", { n: files.length }),
      errorPrefix: t("status.optimizing"),
    });
  }, [process, files.length, t]);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg"
        label={t("dropzone.images_optimize")}
        sublabel={t("dropzone.sublabel_optimize")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onClear={handleClearFiles}
      />

      <ActionButton
        onClick={handleOptimize}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.optimizing")}
        text={files.length > 0 ? t("action.optimize_n", { n: files.length }) : t("action.optimize")}
        icon={<Sparkles className="h-4 w-4" />}
      />

      <ResultsBanner results={results} total={files.length} />
    </div>
  );
}
