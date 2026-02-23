import { useState, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "./ui/ActionButton";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";

interface QrResult {
  output_path: string;
  size: number;
  errors: string[];
}

const SIZE_OPTIONS = [256, 512, 1024, 2048];

export function QrCodeTab() {
  const { t } = useT();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const [text, setText] = useState("");
  const [size, setSize] = useState(512);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QrResult | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      toast.error(t("toast.qr_text_missing"));
      return;
    }
    const outputDir = await getOutputDir("qrcode");
    if (!outputDir) {
      toast.error(t("toast.workspace_missing"));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await invoke<QrResult>("generate_qr_cmd", {
        text: text.trim(),
        size: size,
        outputDir: outputDir,
      });

      setResult(res);

      if (res.output_path && res.errors.length === 0) {
        toast.success(t("toast.qr_success"));
        await openOutputDir("qrcode");
      } else {
        toast.error(res.errors[0] || t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [text, size, getOutputDir, openOutputDir, t]);

  return (
    <div className="space-y-5">
      {/* Text input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.qr_content")}
        </label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          placeholder={t("label.qr_placeholder")}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
        <div className="flex justify-end">
          <span className="text-[10px] text-text-muted">{text.length} chars</span>
        </div>
      </div>

      {/* Size selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          {t("label.qr_size")}
        </label>
        <div className="flex gap-2">
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                size === s
                  ? "border-glass-border bg-accent-muted text-white"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {s}px
            </button>
          ))}
        </div>
      </div>

      <ActionButton
        onClick={handleGenerate}
        disabled={!text.trim()}
        loading={loading}
        loadingText={t("status.generating_qr")}
        text={t("action.generate_qr")}
        icon={<QrCode className="h-4 w-4" />}
      />

      {/* QR preview */}
      {result && result.output_path && (
        <div className="mt-4 rounded-2xl border border-glass-border bg-surface-card p-4 flex flex-col items-center gap-3">
          <div className="rounded-xl overflow-hidden border border-glass-border bg-white p-2">
            <img
              src={`${convertFileSrc(result.output_path)}?t=${Date.now()}`}
              alt="QR Code"
              className="w-40 h-40 object-contain"
            />
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {result.size}×{result.size}px
          </span>
        </div>
      )}
    </div>
  );
}
