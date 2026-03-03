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
      className="relative z-20 flex h-9 shrink-0 items-center justify-between border-b border-indigo-400/10 bg-white/2 backdrop-blur-xl select-none"
    >
      <div className="flex items-center gap-2 px-3 pointer-events-none">
        <img src={icon} alt="Icon" className="h-4 w-4" />
        <span className="text-xs font-semibold text-white tracking-tight">
          Rust-ine
        </span>
      </div>

      <div className="flex h-full">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center text-neutral-500 hover:bg-white/6 hover:text-neutral-300 transition-colors duration-200"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggleMaximize}
          className="flex h-full w-11 items-center justify-center text-neutral-500 hover:bg-white/6 hover:text-neutral-300 transition-colors duration-200"
        >
          <Square className="h-3 w-3" strokeWidth={1.5} />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center text-neutral-500 hover:bg-red-600 hover:text-white transition-colors duration-200"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
