import { useState, useCallback, createContext, useContext } from "react";
import type { TabId } from "../types";

const STORAGE_KEY = "rustine_history";
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  tabId: TabId;
  filesCount: number;
  successCount: number;
  failCount: number;
  outputDir: string;
}

interface HistoryContextValue {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export { HistoryContext };

export function useHistoryProvider(): HistoryContextValue {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);

  const addEntry = useCallback(
    (partial: Omit<HistoryEntry, "id" | "timestamp">) => {
      setEntries((prev) => {
        const entry: HistoryEntry = {
          ...partial,
          id: generateId(),
          timestamp: Date.now(),
        };
        const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
        saveHistory(updated);
        return updated;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    setEntries([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { entries, addEntry, clearHistory };
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return ctx;
}
