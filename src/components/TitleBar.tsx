import { useCallback, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import icon from "../assets/icon.png";

export function TitleBar() {
  const appWindow = useMemo(() => getCurrentWindow(), []);

  const handleMinimize = useCallback(async () => {
    await appWindow.minimize();
  }, [appWindow]);

  const handleToggleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
  }, [appWindow]);

  const handleClose = useCallback(async () => {
    await appWindow.close();
  }, [appWindow]);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button === 0 && e.detail === 1) {
      await appWindow.startDragging();
    }
  }, [appWindow]);

  const handleDoubleClick = useCallback(async () => {
    await appWindow.toggleMaximize();
  }, [appWindow]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-surface select-none"
    >
      <div className="flex items-center gap-2 px-3 pointer-events-none">
        <img src={icon} alt="Icon" className="h-4 w-4" />
        <span className="text-xs font-semibold text-text-primary tracking-tight">
          Rust-ine
        </span>
      </div>

      <div className="flex h-full">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggleMaximize}
          className="flex h-full w-11 items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors cursor-pointer"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center text-text-muted hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
