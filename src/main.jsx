import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./app/Root";
import { useAuth } from "@core/auth/store";
import { migrateStorage } from "@/shared/storage";
import { startDesktopBridge } from "@/desktop/bridge";

import "./index.css";

migrateStorage();
useAuth.getState().init();
void startDesktopBridge();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
