import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./app/AppRoot";
import { useAuth } from "@store/useAuth";
import Login from "@components/auth/Login";

import "./index.css";

function Root() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Login />;

  return <AppRoot />;
}

useAuth.getState().init();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
