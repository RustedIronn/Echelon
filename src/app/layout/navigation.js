import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Home,
  Settings,
  Timer,
  WalletCards,
  Wrench,
} from "lucide-react";

export const appNavigation = Object.freeze([
  { id: "today", label: "Today", path: "/", icon: Home, desktopOrder: 0, mobilePrimaryOrder: 0 },
  { id: "schedule", label: "Schedule", path: "/schedule", icon: CalendarDays, desktopOrder: 1, mobilePrimaryOrder: 1 },
  { id: "focus", label: "Focus", path: "/focus", icon: Timer, desktopOrder: 2, mobilePrimaryOrder: 2 },
  { id: "habits", label: "Habits", path: "/habits", icon: CheckSquare, desktopOrder: 3, mobilePrimaryOrder: 3 },
  { id: "review", label: "Review", path: "/review", icon: BookOpen, desktopOrder: 4, mobileMoreOrder: 3 },
  { id: "settings", label: "Settings", path: "/settings", icon: Settings, desktopOrder: 5, mobileMoreOrder: 5 },
  { id: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3, desktopOrder: 6, mobileMoreOrder: 4 },
  { id: "workouts", label: "Workouts", path: "/workouts", icon: Dumbbell, desktopOrder: 7, mobileMoreOrder: 2 },
  { id: "money", label: "Money", path: "/money", icon: WalletCards, desktopOrder: 8, mobileMoreOrder: 1 },
  { id: "tools", label: "Tools", path: "/tools", icon: Wrench, desktopOrder: 9, mobileMoreOrder: 0 },
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
