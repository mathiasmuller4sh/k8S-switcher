import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ActionHistoryProvider } from "./hooks/useActionHistory";
import { TerminalProvider } from "./hooks/useTerminal";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ActionHistoryProvider>
      <TerminalProvider>
        <App />
      </TerminalProvider>
    </ActionHistoryProvider>
  </React.StrictMode>
);
