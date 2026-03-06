import type { ReactNode } from "react";
import { HistoryContext, useHistoryProvider } from "./useHistory";

export function HistoryProvider({ children }: { children: ReactNode }) {
  const value = useHistoryProvider();
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}
