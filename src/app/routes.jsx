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
import Money from "@pages/Money";
import MoneyOverview from "@features/money/components/MoneyOverview";
import MoneyTransactions from "@features/money/components/MoneyTransactions";
import MoneyBudgets from "@features/money/components/MoneyBudgets";
import MoneyGoals from "@features/money/components/MoneyGoals";
import Tools from "@pages/Tools";
import ToolsOverview from "@features/tools/components/ToolsOverview";
import NowNextLater from "@features/tools/components/NowNextLater";
import BrainDump from "@features/tools/components/BrainDump";
import TaskBreakdown from "@features/tools/components/TaskBreakdown";
import TimeBlindnessTimer from "@features/tools/components/TimeBlindnessTimer";
import ResetMode from "@features/tools/components/ResetMode";
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
      {
        path: "money",
        element: <Money />,
        children: [
          { index: true, element: <MoneyOverview /> },
          { path: "transactions", element: <MoneyTransactions /> },
          { path: "budgets", element: <MoneyBudgets /> },
          { path: "goals", element: <MoneyGoals /> },
        ],
      },
      {
        path: "tools",
        element: <Tools />,
        children: [
          { index: true, element: <ToolsOverview /> },
          { path: "now", element: <NowNextLater /> },
          { path: "brain-dump", element: <BrainDump /> },
          { path: "breakdown", element: <TaskBreakdown /> },
          { path: "timer", element: <TimeBlindnessTimer /> },
          { path: "reset", element: <ResetMode /> },
        ],
      },
    ],
  },
]);
