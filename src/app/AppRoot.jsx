import { RouterProvider } from "react-router-dom";

import { router } from "./routes";

import useEchelonSync from "@hooks/useEchelonSync";
import useDayRollover from "@hooks/useDayRollover";

export default function AppRoot() {
  useEchelonSync();
  useDayRollover();

  return <RouterProvider router={router} />;
}
