import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";
import Today from "../pages/Today";
import Focus from "../pages/Focus";
import Habits from "../pages/Habits";
import Review from "../pages/Review";
import Settings from "../pages/Settings";
import Schedule from "../pages/Schedule";
import Analytics from "../pages/Analytics";
import Workouts from "@pages/Workouts";
import WorkoutToday from "@features/workout/components/WorkoutToday";
import WorkoutCalendar from "@features/workout/components/WorkoutCalendar";
import WorkoutHistory from "@features/workout/components/WorkoutHistory";
import WorkoutHistoryDetail from "@features/workout/components/WorkoutHistoryDetail";
import WorkoutProgress from "@features/workout/components/WorkoutProgress";
import WorkoutExerciseProgress from "@features/workout/components/WorkoutExerciseProgress";
import WorkoutPlans from "@features/workout/components/WorkoutPlans";

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
      {
        path: "workouts",
        element: <Workouts />,
        children: [
          {
            index: true,
            element: <Navigate to="today" replace />,
          },
          {
            path: "today",
            element: <WorkoutToday />,
          },
          {
            path: "calendar",
            element: <WorkoutCalendar />,
          },
          {
            path: "history",
            element: <WorkoutHistory />,
          },
          {
            path: "history/:date",
            element: <WorkoutHistoryDetail />,
          },
          {
            path: "progress",
            element: <WorkoutProgress />,
          },
          {
            path: "progress/exercise/:exerciseId",
            element: <WorkoutExerciseProgress />,
          },
          {
            path: "plans",
            element: <WorkoutPlans />,
          },
        ],
      },
    ],
  },
]);
