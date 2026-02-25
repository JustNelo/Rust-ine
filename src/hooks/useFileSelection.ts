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

  return { files, addFiles, removeFile, clearFiles, setFiles };
}
