import { RouterProvider } from "react-router-dom";

import { router } from "./routes";

import useEchelonSync from "@hooks/useEchelonSync";

export default function AppRoot() {
  useEchelonSync();

  return <RouterProvider router={router} />;
}
