export const PLANNER_STORAGE_KEY = "echelon_planner_v1";
export const PLANNER_VERSION = 1;

export const PLANNER_PRIORITIES = Object.freeze([
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
]);

export const PLANNER_VIEWS = Object.freeze([
  { id: "inbox", label: "Inbox", path: "/planner" },
  { id: "today", label: "Today", path: "/planner/today" },
  { id: "upcoming", label: "Upcoming", path: "/planner/upcoming" },
  { id: "lanes", label: "Now / Next / Later", path: "/planner/lanes", description: "Choose the foreground and shape the queue." },
  { id: "brain-dump", label: "Brain Dump", path: "/planner/brain-dump", description: "Capture thoughts before sorting them." },
  { id: "breakdowns", label: "Breakdowns", path: "/planner/breakdowns", description: "Turn intimidating work into small steps." },
]);
