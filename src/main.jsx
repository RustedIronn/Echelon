import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./app/AppRoot";
import { useAuth } from "@core/auth/store";
import Login from "@core/auth/components/Login";
import { migrateStorage } from "@/shared/storage";

import "./index.css";

function Root() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Login />;

  return <AppRoot />;
}

useAuth.getState().init();

migrateStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
