import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

interface ProgressPayload {
  completed: number;
  total: number;
  current_file?: string;
}

export function useProcessingProgress() {
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  useEffect(() => {
    const unlisten = listen<ProgressPayload>("processing-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return { progress, resetProgress };
}
