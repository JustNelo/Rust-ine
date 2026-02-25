import React from "react";
import ReactDOM from "react-dom/client";
import { I18nProvider } from "./i18n/i18n";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </I18nProvider>
  </React.StrictMode>,
);
