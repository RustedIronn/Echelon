import { RouterProvider } from "react-router-dom";

import { router } from "./routes";

import useEchelonSync from "@hooks/useEchelonSync";
import useDayRollover from "@hooks/useDayRollover";
import useNotificationScheduler from "@features/notifications/useNotificationScheduler.js";

export default function AppRoot() {
  useEchelonSync();
  useDayRollover();
  useNotificationScheduler();

  return <RouterProvider router={router} />;
}
