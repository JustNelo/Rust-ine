import { useState, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Code, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";
import { ActionButton } from "./ui/ActionButton";
import { useFileSelection } from "../hooks/useFileSelection";
import { useT } from "../i18n/i18n";

export function Base64Tab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles } = useFileSelection();
  const [loading, setLoading] = useState(false);
  const [dataUri, setDataUri] = useState("");
  const [copied, setCopied] = useState(false);

  const handleFilesSelected = useCallback((paths: string[]) => {
    addFiles(paths.slice(0, 1));
    setDataUri("");
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    clearFiles();
    setDataUri("");
  }, [clearFiles]);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t("toast.select_images"));
      return;
    }

    setLoading(true);
    setDataUri("");

    try {
      const result = await invoke<string>("image_to_base64", {
        imagePath: files[0],
      });
      setDataUri(result);
      toast.success(t("toast.base64_success"));
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [files, t]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(dataUri);
      setCopied(true);
      toast.success(t("toast.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [dataUri, t]);

  const charCount = dataUri.length;
  const sizeKb = (charCount / 1024).toFixed(1);

  return (
    <div className="space-y-5">
      <DropZone
        accept="png,jpg,jpeg,gif,webp,bmp,ico,svg,tiff,tif"
        label={t("dropzone.images_base64")}
        sublabel={t("dropzone.sublabel_base64")}
        onFilesSelected={handleFilesSelected}
      />

      <FileList files={files} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Image preview */}
      {files.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-glass-border bg-black flex items-center justify-center max-h-40">
          <img
            src={convertFileSrc(files[0])}
            alt=""
            className="max-h-40 object-contain"
          />
        </div>
      )}

      <ActionButton
        onClick={handleConvert}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.converting")}
        text={t("action.to_base64")}
        icon={<Code className="h-4 w-4" />}
      />

      {dataUri && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-text-primary">
                {t("result.base64_ready")}
              </span>
              <span className="rounded-md bg-surface border border-border px-2 py-0.5 text-[10px] font-mono text-text-muted">
                {charCount.toLocaleString()} chars · {sizeKb} KB
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-all cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("label.copied") : t("label.copy")}
            </button>
          </div>

          <div className="rounded-xl border border-glass-border bg-surface-card p-3 max-h-32 overflow-y-auto">
            <code className="text-[10px] font-mono text-text-secondary break-all leading-relaxed">
              {dataUri.slice(0, 500)}{dataUri.length > 500 ? "…" : ""}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
