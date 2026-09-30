import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";
import Today from "@features/today/Today.jsx";
import FocusCompatibility from "@features/focus/components/FocusCompatibility.jsx";
import Habits from "@features/habits/Habits.jsx";
import Calendar from "@features/calendar/components/CalendarView.jsx";
import ComposureReview from "@features/insights/review/components/ComposureReview.jsx";
import DailyReview from "@features/insights/review/components/DailyReview.jsx";
import InsightsLayout from "@features/insights/components/InsightsLayout.jsx";
import InsightsOverview from "@features/insights/components/InsightsOverview.jsx";
import Settings from "@features/settings/Settings.jsx";
import Schedule from "@features/plan/schedule/Schedule.jsx";
import Analytics from "@features/insights/Analysis.jsx";
import Workouts from "@features/workouts/components/WorkoutLayout.jsx";
import Money from "@features/money/components/MoneyLayout.jsx";
import MoneyBudgets from "@features/money/components/MoneyBudgets.jsx";
import MoneyGoals from "@features/money/components/MoneyGoals.jsx";
import MoneyOverview from "@features/money/components/MoneyOverview.jsx";
import MoneyTransactions from "@features/money/components/MoneyTransactions.jsx";
import PlannerWorkspace from "@features/plan/planner/components/PlannerWorkspace.jsx";
import NotesWorkspace from "@features/plan/notes/NotesWorkspace.jsx";
import PlanLayout from "@features/plan/PlanLayout.jsx";
import WorkoutExerciseProgress from "@features/workouts/components/WorkoutExerciseProgress.jsx";
import WorkoutHistory from "@features/workouts/components/WorkoutHistory.jsx";
import WorkoutHistoryDetail from "@features/workouts/components/WorkoutHistoryDetail.jsx";
import WorkoutPlan from "@features/workouts/components/WorkoutPlan.jsx";
import WorkoutToday from "@features/workouts/components/WorkoutToday.jsx";

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
        element: <FocusCompatibility />,
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
      { path: "planner/completed", element: <Navigate to="/plan/planner/completed" replace /> },
      {
        path: "plan",
        element: <PlanLayout />,
        children: [
          { index: true, element: <Navigate to="schedule" replace /> },
          { path: "schedule", element: <Schedule embedded /> },
          { path: "planner", element: <PlannerWorkspace embedded basePath="/plan/planner" /> },
          { path: "planner/today", element: <PlannerWorkspace embedded basePath="/plan/planner" /> },
          { path: "planner/upcoming", element: <PlannerWorkspace embedded basePath="/plan/planner" /> },
          { path: "planner/completed", element: <PlannerWorkspace embedded basePath="/plan/planner" /> },
          { path: "notes", element: <NotesWorkspace /> },
          { path: "planner/lanes", element: <Navigate to="/plan/planner" replace /> },
          { path: "planner/brain-dump", element: <Navigate to="/plan/notes" replace /> },
          { path: "planner/breakdowns", element: <Navigate to="/plan/notes?legacyBreakdowns=1" replace /> },
        ],
      },
      {
        path: "analytics",
        element: <Navigate to="/insights/analysis" replace />,
      },
      {
        path: "insights",
        element: <InsightsLayout />,
        children: [
          { index: true, element: <InsightsOverview /> },
          { path: "daily", element: <DailyReview /> },
          { path: "composure", element: <ComposureReview /> },
          { path: "analysis", element: <Analytics /> },
          { path: "trends", element: <Navigate to="/insights/analysis" replace /> },
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
            element: <WorkoutPlan />,
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
      { path: "tools", element: <Navigate to="/plan/notes" replace /> },
      { path: "tools/now", element: <Navigate to="/plan/planner" replace /> },
      { path: "tools/brain-dump", element: <Navigate to="/plan/notes" replace /> },
      { path: "tools/breakdown", element: <Navigate to="/plan/notes?legacyBreakdowns=1" replace /> },
      { path: "tools/timer", element: <Navigate to="/focus" replace /> },
      { path: "tools/reset", element: <Navigate to="/settings" replace /> },
    ],
  },
]);
