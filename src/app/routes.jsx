import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";
import Today from "../pages/Today";
import Focus from "../pages/Focus";
import Habits from "../pages/Habits";
import Calendar from "../pages/Calendar";
import DailyReview from "@features/review/components/DailyReview";
import ComposureReview from "@features/review/components/ComposureReview";
import InsightsLayout from "@features/insights/components/InsightsLayout";
import InsightsOverview from "@features/insights/components/InsightsOverview";
import Settings from "../pages/Settings";
import Schedule from "../pages/Schedule";
import Analytics from "../pages/Analytics";
import Workouts from "@pages/Workouts";
import Money from "@pages/Money";
import MoneyOverview from "@features/money/components/MoneyOverview";
import MoneyTransactions from "@features/money/components/MoneyTransactions";
import MoneyBudgets from "@features/money/components/MoneyBudgets";
import MoneyGoals from "@features/money/components/MoneyGoals";
import Planner from "@pages/Planner";
import PlanLayout from "@features/plan/components/PlanLayout";
import WorkoutToday from "@features/workout/components/WorkoutToday";
import WorkoutHistory from "@features/workout/components/WorkoutHistory";
import WorkoutHistoryDetail from "@features/workout/components/WorkoutHistoryDetail";
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
        path: "calendar",
        element: <Calendar />,
      },
      {
        path: "review",
        element: <Navigate to="/insights/daily" replace />,
      },
      {
        path: "review/composure",
        element: <Navigate to="/insights/composure" replace />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      { path: "schedule", element: <Navigate to="/plan/schedule" replace /> },
      { path: "planner", element: <Navigate to="/plan/planner" replace /> },
      { path: "planner/today", element: <Navigate to="/plan/planner/today" replace /> },
      { path: "planner/upcoming", element: <Navigate to="/plan/planner/upcoming" replace /> },
      {
        path: "plan",
        element: <PlanLayout />,
        children: [
          { index: true, element: <Navigate to="schedule" replace /> },
          { path: "schedule", element: <Schedule embedded /> },
          { path: "planner", element: <Planner embedded basePath="/plan/planner" /> },
          { path: "planner/today", element: <Planner embedded basePath="/plan/planner" /> },
          { path: "planner/upcoming", element: <Planner embedded basePath="/plan/planner" /> },
          { path: "planner/lanes", element: <Planner embedded basePath="/plan/planner" /> },
          { path: "planner/brain-dump", element: <Planner embedded basePath="/plan/planner" /> },
          { path: "planner/breakdowns", element: <Planner embedded basePath="/plan/planner" /> },
        ],
      },
      {
        path: "analytics",
        element: <Navigate to="/insights/trends" replace />,
      },
      {
        path: "insights",
        element: <InsightsLayout />,
        children: [
          { index: true, element: <InsightsOverview /> },
          { path: "daily", element: <DailyReview /> },
          { path: "composure", element: <ComposureReview /> },
          { path: "trends", element: <Analytics /> },
        ],
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
            element: <Navigate to="/calendar" replace />,
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
            element: <Navigate to="/workouts/history?view=insights" replace />,
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
      { path: "tools", element: <Navigate to="/plan/planner/lanes" replace /> },
      { path: "tools/now", element: <Navigate to="/plan/planner/lanes" replace /> },
      { path: "tools/brain-dump", element: <Navigate to="/plan/planner/brain-dump" replace /> },
      { path: "tools/breakdown", element: <Navigate to="/plan/planner/breakdowns" replace /> },
      { path: "tools/timer", element: <Navigate to="/focus" replace /> },
      { path: "tools/reset", element: <Navigate to="/settings" replace /> },
    ],
  },
]);
