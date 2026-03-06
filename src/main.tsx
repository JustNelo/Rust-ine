import React from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "./i18n/i18n";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import { HistoryProvider } from "./hooks/HistoryProvider";
import { ThemeProvider } from "./hooks/useTheme";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <WorkspaceProvider>
          <HistoryProvider>
            <App />
          </HistoryProvider>
        </WorkspaceProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
