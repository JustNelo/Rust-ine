import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "./ui/ActionButton";
import { useWorkspace } from "../hooks/useWorkspace";
import { useHistory } from "../hooks/useHistory";
import { useT } from "../i18n/i18n";
import { safeAssetUrl } from "../lib/utils";

interface QrResult {
  output_path: string;
  size: number;
  errors: string[];
}

const SIZE_OPTIONS = [256, 512, 1024, 2048];

export function QrCodeTab() {
  const { t } = useT();
  const { getOutputDir } = useWorkspace();
  const { addEntry } = useHistory();
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

      addEntry({ tabId: "qrcode", filesCount: 1, successCount: res.output_path ? 1 : 0, failCount: res.errors.length, outputDir });

      if (res.output_path && res.errors.length === 0) {
        toast.success(t("toast.qr_success"));
      } else {
        toast.error(res.errors[0] || t("toast.all_failed"));
      }
    } catch (err) {
      toast.error(`${err}`);
    } finally {
      setLoading(false);
    }
  }, [text, size, getOutputDir, addEntry, t]);

  return (
    <div className="space-y-5">
      {/* Text input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.qr_content")}
        </label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          placeholder={t("label.qr_placeholder")}
          rows={3}
          className="w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 resize-none"
        />
        <div className="flex justify-end">
          <span className="text-[10px] text-neutral-500">{text.length} chars</span>
        </div>
      </div>

      {/* Size selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {t("label.qr_size")}
        </label>
        <div className="flex gap-2">
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300 cursor-pointer ${
                size === s
                  ? "border-indigo-400/25 bg-indigo-500/10 text-indigo-300"
                  : "border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10 hover:border-white/20"
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
        icon={<QrCode className="h-4 w-4" strokeWidth={1.5} />}
      />

      {/* QR preview */}
      {result && result.output_path && (
        <div className="mt-4 relative overflow-hidden rounded-2xl border border-white/8 bg-white/2 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-4 flex flex-col items-center gap-3">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-indigo-400/20 to-transparent" />
          <div className="relative rounded-xl overflow-hidden border border-white/8 bg-white p-2">
            <img
              src={safeAssetUrl(result.output_path, true)}
              alt="QR Code"
              className="w-40 h-40 object-contain"
            />
          </div>
          <span className="relative text-[10px] font-mono text-neutral-500">
            {result.size}×{result.size}px
          </span>
        </div>
      )}
    </div>
  );
}
