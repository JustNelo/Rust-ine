import { useState, useCallback, useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FileUp,
  Scissors,
  Image,
  FileDown,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Upload,
  CheckCircle,
  XCircle,
  Zap,
  Shield,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatSize } from "../lib/utils";
import { PdfPageGrid } from "./PdfPageGrid";
import { ActionButton } from "./ui/ActionButton";
import { Slider } from "./ui/Slider";
import { useWorkspace } from "../hooks/useWorkspace";
import { useT } from "../i18n/i18n";
import {
  usePdfWorkbench,
  type PrimaryAction,
  type ExportFormat,
  type ExportDpi,
  type PostProcessing,
  type PipelineStep,
  type WorkbenchResult,
} from "../hooks/usePdfWorkbench";

const ACCEPTED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf",
]);

// --- Password strength helper ---
function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { level: 2, label: "Medium", color: "bg-yellow-500" };
  return { level: 3, label: "Strong", color: "bg-green-500" };
}

// --- Primary action definitions ---
interface ActionDef {
  id: PrimaryAction;
  labelKey: string;
  icon: typeof FileUp;
}

const PRIMARY_ACTIONS: ActionDef[] = [
  { id: "build", labelKey: "pdf_tool.build", icon: FileUp },
  { id: "split", labelKey: "pdf_tool.split", icon: Scissors },
  { id: "export-images", labelKey: "pdf_tool.export_images", icon: Image },
  { id: "extract-images", labelKey: "pdf_tool.extract_images", icon: FileDown },
];

// Actions that output PDF (support post-processing)
const PDF_OUTPUT_ACTIONS = new Set<PrimaryAction>(["build"]);

// --- Pipeline step labels ---
const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  materialize: "status.materializing",
  build: "status.building",
  split: "status.splitting",
  "export-images": "status.exporting_pages",
  "extract-images": "status.extracting",
  compress: "status.compressing_pdf",
  protect: "status.protecting_pdf",
};

// --- Main Component ---

export function PdfWorkbenchTab() {
  const { t } = useT();
  const { getOutputDir, openOutputDir } = useWorkspace();
  const {
    pages,
    loading,
    loadingThumbnails,
    result,
    gridModified,
    pipelineStep,
    addFiles,
    removePage,
    reorderPages,
    clearAll,
    executePipeline,
    unlockPdf,
  } = usePdfWorkbench();

  // Mode: "workbench" (grid + actions) or "unlock" (standalone)
  const [mode, setMode] = useState<"workbench" | "unlock">("workbench");

  // Primary action
  const [activeTool, setActiveTool] = useState<PrimaryAction>("build");

  // Build options
  const [outputName, setOutputName] = useState("document.pdf");

  // Split options
  const [ranges, setRanges] = useState("1-end");

  // Export images options
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportDpi, setExportDpi] = useState<ExportDpi>(150);

  // Post-processing toggles
  const [ppCompress, setPpCompress] = useState(false);
  const [ppCompressQuality, setPpCompressQuality] = useState(60);
  const [ppProtect, setPpProtect] = useState(false);
  const [ppPassword, setPpPassword] = useState("");
  const ppPasswordStrength = useMemo(() => getPasswordStrength(ppPassword), [ppPassword]);

  // Unlock mode state
  const [unlockFile, setUnlockFile] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");

  // Show post-processing options only for PDF-output actions
  const showPostProcessing = PDF_OUTPUT_ACTIONS.has(activeTool);

  // Window-level drag-drop listener
  const filterPaths = useMemo(() => {
    return (paths: string[]) =>
      paths.filter((p) => {
        const ext = p.split(".").pop()?.toLowerCase() || "";
        return ACCEPTED_EXTENSIONS.has(ext);
      });
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const filtered = filterPaths(event.payload.paths);
        if (filtered.length > 0) {
          if (mode === "unlock") {
            const pdfs = filtered.filter((p) => p.toLowerCase().endsWith(".pdf"));
            if (pdfs.length > 0) setUnlockFile(pdfs[0]);
          } else {
            addFiles(filtered);
          }
        }
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [filterPaths, addFiles, mode]);

  const handleAddMore = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Images & PDFs",
            extensions: [
              "png", "jpg", "jpeg", "bmp", "ico", "tiff", "tif", "webp", "pdf",
            ],
          },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) addFiles(paths);
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, [addFiles]);

  const handleSelectUnlockFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (selected && typeof selected === "string") setUnlockFile(selected);
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, []);

  // --- Pipeline execute ---
  const handleExecute = useCallback(async () => {
    const outputDir = await getOutputDir("pdf-toolkit");
    if (!outputDir) {
      toast.error(t("toast.no_workspace"));
      return;
    }

    const postProcessing: PostProcessing = {
      compress: showPostProcessing && ppCompress,
      compressQuality: ppCompressQuality,
      protect: showPostProcessing && ppProtect,
      protectPassword: ppPassword,
    };

    await executePipeline(
      activeTool,
      outputDir,
      () => openOutputDir("pdf-toolkit"),
      {
        outputName,
        ranges,
        exportFormat,
        exportDpi,
      },
      postProcessing
    );
  }, [
    activeTool, outputName, ranges, exportFormat, exportDpi,
    ppCompress, ppCompressQuality, ppProtect, ppPassword,
    showPostProcessing, getOutputDir, openOutputDir, executePipeline,
  ]);

  // --- Unlock execute ---
  const handleUnlock = useCallback(async () => {
    if (!unlockFile || !unlockPassword.trim()) return;
    const outputDir = await getOutputDir("pdf-toolkit");
    if (!outputDir) return;
    await unlockPdf(unlockFile, unlockPassword, outputDir, () => openOutputDir("pdf-toolkit"));
  }, [unlockFile, unlockPassword, getOutputDir, openOutputDir, unlockPdf]);

  // --- Disable logic ---
  const isExecuteDisabled = useMemo(() => {
    if (loading) return true;
    if (pages.length === 0) return true;
    if (ppProtect && showPostProcessing && !ppPassword.trim()) return true;
    return false;
  }, [loading, pages.length, ppProtect, ppPassword, showPostProcessing]);

  // --- Action button text ---
  const actionButtonText = useMemo(() => {
    if (pipelineStep) {
      return {
        text: t(PIPELINE_STEP_LABELS[pipelineStep]),
        loadingText: t(PIPELINE_STEP_LABELS[pipelineStep]),
      };
    }
    const map: Record<PrimaryAction, { text: string; loadingText: string }> = {
      "build": { text: t("action.build_pdf"), loadingText: t("status.building") },
      "split": { text: t("action.pdf_split"), loadingText: t("status.splitting") },
      "export-images": { text: t("action.pdf_to_images"), loadingText: t("status.exporting_pages") },
      "extract-images": { text: t("action.extract"), loadingText: t("status.extracting") },
    };
    return map[activeTool];
  }, [activeTool, pipelineStep, t]);

  // --- Action icon ---
  const actionIcon = useMemo(() => {
    const map: Record<PrimaryAction, React.ReactNode> = {
      "build": <FileUp className="h-4 w-4" />,
      "split": <Scissors className="h-4 w-4" />,
      "export-images": <Image className="h-4 w-4" />,
      "extract-images": <FileDown className="h-4 w-4" />,
    };
    return map[activeTool];
  }, [activeTool]);

  // --- Build pipeline step summary ---
  const pipelineSummary = useMemo(() => {
    const steps: string[] = [t(`pdf_tool.${activeTool === "build" ? "build" : activeTool}`)];
    if (showPostProcessing && ppCompress) steps.push(t("pdf_tool.compress"));
    if (showPostProcessing && ppProtect) steps.push(t("pdf_tool.protect"));
    return steps;
  }, [activeTool, ppCompress, ppProtect, showPostProcessing, t]);

  return (
    <div className="space-y-5">
      {/* Mode switcher: Workbench / Unlock */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("workbench")}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer border",
            mode === "workbench"
              ? "bg-accent/15 text-white border-accent/40"
              : "bg-surface-card text-text-secondary border-glass-border hover:bg-surface-hover"
          )}
        >
          {t("pdf_tool.workbench_mode")}
        </button>
        <button
          onClick={() => setMode("unlock")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer border",
            mode === "unlock"
              ? "bg-accent/15 text-white border-accent/40"
              : "bg-surface-card text-text-secondary border-glass-border hover:bg-surface-hover"
          )}
        >
          <Unlock className="h-3.5 w-3.5" />
          {t("pdf_tool.unlock_mode")}
        </button>
      </div>

      {/* ========== UNLOCK MODE ========== */}
      {mode === "unlock" && (
        <div className="space-y-4">
          {/* Drop zone for unlock */}
          <div
            onClick={handleSelectUnlockFile}
            className="relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent/20 bg-accent/2 p-8 cursor-pointer transition-all duration-200 hover:bg-accent/5 hover:border-accent/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent/70">
              <Lock className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">{t("pdf_tool.drop_locked_pdf")}</p>
              <p className="mt-1 text-xs text-text-muted">{t("pdf_tool.drop_locked_pdf_hint")}</p>
            </div>
          </div>

          {unlockFile && (
            <div className="rounded-2xl border border-glass-border bg-surface-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-text-primary truncate">
                  {unlockFile.split(/[\\/]/).pop()}
                </span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  {t("label.pdf_password")}
                </label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <ActionButton
                onClick={handleUnlock}
                disabled={loading || !unlockPassword.trim()}
                loading={loading}
                loadingText={t("status.unlocking_pdf")}
                text={t("action.unlock_pdf")}
                icon={<Unlock className="h-4 w-4" />}
              />
            </div>
          )}

          <ResultPanel result={result} t={t} />
        </div>
      )}

      {/* ========== WORKBENCH MODE ========== */}
      {mode === "workbench" && (
        <>
          {/* Drop zone / Add files bar */}
          {pages.length === 0 ? (
            <div
              onClick={handleAddMore}
              className="relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent/20 bg-accent/2 p-8 cursor-pointer transition-all duration-200 hover:bg-accent/5 hover:border-accent/30 hover:shadow-[0_0_20px_rgba(108,108,237,0.08)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent/70">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary">{t("dropzone.pdf_workbench")}</p>
                <p className="mt-1 text-xs text-text-muted">{t("dropzone.sublabel_pdf_workbench")}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddMore}
                className="flex items-center gap-2 rounded-xl border border-glass-border bg-surface-card px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-white transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {t("label.add_files")}
              </button>
              {/* Grid modified indicator */}
              {gridModified && (
                <span className="flex items-center gap-1 text-[10px] text-accent">
                  <AlertTriangle className="h-3 w-3" />
                  {t("pdf_tool.grid_modified")}
                </span>
              )}
              <span className="text-[10px] text-text-muted ml-auto">
                {pages.length} {t("pdf_tool.pages_count")}
              </span>
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-white hover:bg-surface-hover transition-all cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                {t("label.clear_all")}
              </button>
            </div>
          )}

          {/* Page grid */}
          <PdfPageGrid
            pages={pages}
            loadingThumbnails={loadingThumbnails}
            onReorder={reorderPages}
            onRemove={removePage}
          />

          {/* Action selector + options (only when pages loaded) */}
          {pages.length > 0 && (
            <>
              {/* Primary action selector */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  {t("pdf_tool.primary_action")}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PRIMARY_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    const isActive = activeTool === action.id;
                    return (
                      <button
                        key={action.id}
                        onClick={() => setActiveTool(action.id)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-[11px] font-medium transition-all cursor-pointer border",
                          isActive
                            ? "bg-accent/15 text-white border-accent/40 shadow-[0_0_16px_rgba(108,108,237,0.2)]"
                            : "bg-surface-card text-text-secondary border-glass-border hover:bg-surface-hover hover:text-text-primary"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", isActive && "text-accent")} />
                        {t(action.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic options panel */}
              <div className="rounded-2xl border border-glass-border bg-surface-card p-4 space-y-4">
                {activeTool === "build" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-secondary">
                      {t("label.filename")}
                    </label>
                    <input
                      type="text"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder={t("label.placeholder_filename")}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-hover focus:outline-none"
                    />
                  </div>
                )}

                {activeTool === "split" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-secondary">
                      {t("label.page_ranges")}
                    </label>
                    <input
                      type="text"
                      value={ranges}
                      onChange={(e) => setRanges(e.target.value)}
                      placeholder="1-3, 4-10, 11-end"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-border-hover focus:outline-none"
                    />
                    <p className="text-[10px] text-text-muted">
                      {t("label.page_ranges_hint")}
                    </p>
                  </div>
                )}

                {activeTool === "export-images" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-2 block">
                        {t("label.output_format_images")}
                      </label>
                      <div className="flex gap-2">
                        {(["png", "jpg"] as ExportFormat[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => setExportFormat(f)}
                            className={cn(
                              "rounded-md px-4 py-1.5 text-xs font-medium uppercase transition-all cursor-pointer",
                              exportFormat === f
                                ? "bg-accent-muted text-white border border-glass-border"
                                : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-2 block">
                        {t("label.dpi")}
                      </label>
                      <div className="flex gap-2">
                        {([72, 150, 300] as ExportDpi[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setExportDpi(d)}
                            className={cn(
                              "rounded-md px-4 py-1.5 text-xs font-medium transition-all cursor-pointer",
                              exportDpi === d
                                ? "bg-accent-muted text-white border border-glass-border"
                                : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                            )}
                          >
                            {d} DPI
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === "extract-images" && (
                  <p className="text-xs text-text-muted">
                    {t("pdf_tool.extract_images_hint")}
                  </p>
                )}

                {/* Post-processing toggles (only for PDF output actions) */}
                {showPostProcessing && (
                  <div className="border-t border-glass-border pt-3 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {t("pdf_tool.post_processing")}
                    </p>

                    {/* Compress toggle */}
                    <div>
                      <button
                        onClick={() => setPpCompress(!ppCompress)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer w-full border",
                          ppCompress
                            ? "bg-accent/15 text-white border-accent/30"
                            : "bg-surface text-text-secondary border-border hover:bg-surface-hover"
                        )}
                      >
                        <Zap className={cn("h-3.5 w-3.5", ppCompress && "text-accent")} />
                        {t("pdf_tool.compress")}
                        <div className={cn(
                          "ml-auto h-4 w-7 rounded-full transition-all",
                          ppCompress ? "bg-accent" : "bg-surface-hover"
                        )}>
                          <div className={cn(
                            "h-3 w-3 rounded-full bg-white mt-0.5 transition-all",
                            ppCompress ? "ml-3.5" : "ml-0.5"
                          )} />
                        </div>
                      </button>
                      {ppCompress && (
                        <div className="mt-2 pl-2">
                          <Slider
                            label={t("label.image_quality_pdf")}
                            value={ppCompressQuality}
                            min={10}
                            max={95}
                            leftHint={t("label.smaller_file")}
                            rightHint={t("label.higher_quality")}
                            onChange={setPpCompressQuality}
                          />
                        </div>
                      )}
                    </div>

                    {/* Protect toggle */}
                    <div>
                      <button
                        onClick={() => setPpProtect(!ppProtect)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer w-full border",
                          ppProtect
                            ? "bg-accent/15 text-white border-accent/30"
                            : "bg-surface text-text-secondary border-border hover:bg-surface-hover"
                        )}
                      >
                        <Shield className={cn("h-3.5 w-3.5", ppProtect && "text-accent")} />
                        {t("pdf_tool.protect")}
                        <div className={cn(
                          "ml-auto h-4 w-7 rounded-full transition-all",
                          ppProtect ? "bg-accent" : "bg-surface-hover"
                        )}>
                          <div className={cn(
                            "h-3 w-3 rounded-full bg-white mt-0.5 transition-all",
                            ppProtect ? "ml-3.5" : "ml-0.5"
                          )} />
                        </div>
                      </button>
                      {ppProtect && (
                        <div className="mt-2 pl-2 space-y-1.5">
                          <input
                            type="password"
                            value={ppPassword}
                            onChange={(e) => setPpPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          {ppPassword && (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1 flex-1">
                                {[1, 2, 3].map((i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "h-1 flex-1 rounded-full transition-all",
                                      i <= ppPasswordStrength.level ? ppPasswordStrength.color : "bg-surface-hover"
                                    )}
                                  />
                                ))}
                              </div>
                              <span className={cn(
                                "text-[10px] font-medium",
                                ppPasswordStrength.level <= 1 ? "text-red-400" :
                                ppPasswordStrength.level <= 2 ? "text-yellow-400" : "text-green-400"
                              )}>
                                {ppPasswordStrength.label}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pipeline summary */}
                {pipelineSummary.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                    <span>{t("pdf_tool.pipeline")}:</span>
                    {pipelineSummary.map((step, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-accent">→</span>}
                        <span className="text-text-secondary font-medium">{step}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Pipeline progress indicator */}
                {pipelineStep && (
                  <div className="flex items-center gap-2 text-xs text-accent">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t(PIPELINE_STEP_LABELS[pipelineStep])}</span>
                  </div>
                )}

                {/* Execute button */}
                <ActionButton
                  onClick={handleExecute}
                  disabled={isExecuteDisabled}
                  loading={loading}
                  loadingText={actionButtonText.loadingText}
                  text={actionButtonText.text}
                  icon={actionIcon}
                />
              </div>
            </>
          )}

          {/* Result panel */}
          <ResultPanel result={result} t={t} />
        </>
      )}
    </div>
  );
}

// --- Result display component ---

interface ResultPanelProps {
  result: WorkbenchResult | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ResultPanel({ result, t }: ResultPanelProps) {
  if (!result) return null;

  let successIcon = true;
  let mainText = "";
  let errors: string[] = [];
  let extraContent: React.ReactNode = null;

  switch (result.type) {
    case "build":
      successIcon = result.data.errors.length === 0;
      mainText = t("toast.build_success", { n: result.data.page_count });
      errors = result.data.errors;
      break;

    case "split":
      successIcon = result.data.errors.length === 0;
      mainText = t("result.split_files", { n: result.data.output_files.length });
      errors = result.data.errors;
      break;

    case "export-images":
      successIcon = result.data.errors.length === 0;
      mainText = t("result.exported_pages", { n: result.data.exported });
      errors = result.data.errors;
      break;

    case "extract-images":
      successIcon = result.data.errors.length === 0;
      mainText = t("result.extracted", { n: result.data.total_extracted });
      errors = result.data.errors;
      break;

    case "compress": {
      const d = result.data;
      successIcon = d.errors.length === 0 && !!d.output_path;
      mainText = t("result.pdf_compressed", {
        original: formatSize(d.original_size),
        compressed: formatSize(d.compressed_size),
      });
      errors = d.errors;
      if (d.original_size > 0 && d.output_path) {
        extraContent = (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{
                  width: `${Math.max(5, (d.compressed_size / d.original_size) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-text-muted">
              {d.original_size > d.compressed_size
                ? `-${(((d.original_size - d.compressed_size) / d.original_size) * 100).toFixed(1)}%`
                : "No reduction"}
            </span>
          </div>
        );
      }
      break;
    }

    case "protect":
      successIcon = result.data.success;
      mainText = result.data.success
        ? result.mode === "protect"
          ? t("result.pdf_protected")
          : t("result.pdf_unlocked")
        : result.data.errors[0] || t("toast.all_failed");
      errors = result.data.success ? [] : result.data.errors;
      break;

    case "pipeline":
      successIcon = result.errors.length === 0;
      mainText = t("result.pipeline_complete", { steps: result.steps.join(" → ") });
      errors = result.errors;
      break;
  }

  return (
    <div className="rounded-2xl border border-glass-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {successIcon ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-warning" />
        )}
        <span className="text-xs font-medium text-text-primary">{mainText}</span>
      </div>

      {extraContent}

      {errors.length > 0 && (
        <div className="max-h-24 overflow-y-auto space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-error/80">
              <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
