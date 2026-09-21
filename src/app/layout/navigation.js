import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Dumbbell,
  Home,
  Settings,
  Sparkles,
  WalletCards,
} from "lucide-react";

export const appNavigation = Object.freeze([
  { id: "today", label: "Today", path: "/", icon: Home, desktopOrder: 0, mobilePrimaryOrder: 0 },
  { id: "plan", label: "Plan", path: "/plan", icon: CalendarRange, desktopOrder: 1, mobilePrimaryOrder: 1 },
  { id: "calendar", label: "Calendar", path: "/calendar", icon: CalendarDays, desktopOrder: 2, mobilePrimaryOrder: 2 },
  { id: "habits", label: "Habits", path: "/habits", icon: CheckSquare, desktopOrder: 3, mobilePrimaryOrder: 3 },
  { id: "workouts", label: "Workouts", path: "/workouts", icon: Dumbbell, desktopOrder: 4, mobileMoreOrder: 0 },
  { id: "money", label: "Money", path: "/money", icon: WalletCards, desktopOrder: 5, mobileMoreOrder: 1 },
  { id: "insights", label: "Insights", path: "/insights", icon: Sparkles, desktopOrder: 6, mobileMoreOrder: 2 },
  { id: "settings", label: "Settings", path: "/settings", icon: Settings, desktopOrder: 7, mobileMoreOrder: 3 },
]);

const byOrder = (field) => (left, right) => left[field] - right[field];

export const desktopNavigation = appNavigation
  .filter((item) => Number.isInteger(item.desktopOrder))
  .sort(byOrder("desktopOrder"));

export const mobilePrimaryNavigation = appNavigation
  .filter((item) => Number.isInteger(item.mobilePrimaryOrder))
  .sort(byOrder("mobilePrimaryOrder"));

export const mobileMoreNavigation = appNavigation
  .filter((item) => Number.isInteger(item.mobileMoreOrder))
  .sort(byOrder("mobileMoreOrder"));
