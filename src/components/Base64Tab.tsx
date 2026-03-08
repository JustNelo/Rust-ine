import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Code, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DropZone } from "./DropZone";
import { ImageGrid } from "./ImageGrid";
import { ActionButton } from "./ui/ActionButton";
import { useFileSelection } from "../hooks/useFileSelection";
import { useT } from "../i18n/i18n";
import { safeAssetUrl } from "../lib/utils";

export function Base64Tab() {
  const { t } = useT();
  const { files, addFiles, removeFile, clearFiles, reorderFiles } = useFileSelection();
  const [loading, setLoading] = useState(false);
  const [dataUri, setDataUri] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent setting state on unmounted component
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleFilesSelected = useCallback(
    (paths: string[]) => {
      addFiles(paths.slice(0, 1));
      setDataUri("");
    },
    [addFiles],
  );

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
      toast.error(t("toast.operation_failed"));
    } finally {
      setLoading(false);
    }
  }, [files, t]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(dataUri);
      setCopied(true);
      toast.success(t("toast.copied"));
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("toast.copy_failed"));
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

      <ImageGrid files={files} onReorder={reorderFiles} onRemove={removeFile} onClear={handleClearFiles} />

      {/* Image preview */}
      {files.length > 0 && (
        <div className="overflow-hidden flex items-center justify-center max-h-40" style={{ borderRadius: 12, border: '1px solid var(--bg-border)', background: 'var(--bg-base)' }}>
          <img src={safeAssetUrl(files[0])} alt="" className="max-h-40 object-contain" />
        </div>
      )}

      <ActionButton
        onClick={handleConvert}
        disabled={files.length === 0}
        loading={loading}
        loadingText={t("status.converting")}
        text={t("action.to_base64")}
        icon={<Code className="h-4 w-4" strokeWidth={1.5} />}
      />

      {dataUri && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{t("result.base64_ready")}</span>
              <span className="forge-chip">
                {charCount.toLocaleString()} chars · {sizeKb} KB
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="btn-ghost"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} strokeWidth={1.5} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {copied ? t("label.copied") : t("label.copy")}
            </button>
          </div>

          <div className="forge-card p-3 max-h-32 overflow-y-auto">
            <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {dataUri.slice(0, 500)}
              {dataUri.length > 500 ? "…" : ""}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
