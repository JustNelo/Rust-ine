import { useState, useCallback } from "react";

export function useFileSelection() {
  const [files, setFiles] = useState<string[]>([]);

  const addFiles = useCallback((paths: string[]) => {
    setFiles((prev) => {
      const existing = new Set(prev);
      const unique = paths.filter((p) => !existing.has(p));
      return unique.length > 0 ? [...prev, ...unique] : prev;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  return { files, addFiles, removeFile, clearFiles, reorderFiles, setFiles };
}
