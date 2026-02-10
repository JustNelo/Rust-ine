import { useState, useCallback } from "react";

export function useFileSelection() {
  const [files, setFiles] = useState<string[]>([]);

  const addFiles = useCallback((paths: string[]) => {
    setFiles((prev) => [...prev, ...paths]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return { files, addFiles, removeFile, clearFiles, setFiles };
}
