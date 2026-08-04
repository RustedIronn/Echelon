import { createBrowserRouter } from "react-router-dom";
import Layout from "@components/layout/Layout";
import Today from "../pages/Today";
import Focus from "../pages/Focus";
import Habits from "../pages/Habits";
import Review from "../pages/Review";
import Settings from "../pages/Settings";
import Schedule from "../pages/Schedule";
import Analytics from "../pages/Analytics";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Today />,
      },
      {
        path: "focus",
        element: <Focus />,
      },
      {
        path: "habits",
        element: <Habits />,
      },
      {
        path: "review",
        element: <Review />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "schedule",
        element: <Schedule />,
      },
      {
        path: "analytics",
        element: <Analytics />,
      },
    ],
  },
]);
