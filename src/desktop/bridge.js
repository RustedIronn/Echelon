import { router } from "@/app/routes";
import { useAuth } from "@core/auth/store";
import { getStorageOwner, subscribeStorageOwner } from "@/shared/storage";
import { useFocus } from "@features/focus/store.js";
import { useFocusSurface } from "@features/focus/surface.js";
import { useWorkout } from "@features/workouts/store.js";
import { WORKOUT_RUNNER_VERSION } from "@features/workouts/runner.js";
import { isWithinQuietHours } from "@features/notifications/utils.js";
import { useNotifications } from "@features/notifications/store.js";
import { DESKTOP_WAKE_EVENT, isDesktop } from "./environment";
import { refreshDesktopPermission, showDesktopNotification, updateDesktopPause } from "./notifications";
import { registerQuickNoteShortcut } from "./shortcuts";
import { readDesktopPause, restoreDesktopWindow } from "./window";

let pendingContext = null;
let lifecycle = { status: "idle", error: "" };
let startPromise = null;
let cleanupTasks = [];
const lifecycleListeners = new Set();

function setLifecycle(status, error = "") {
  lifecycle = { status, error };
  lifecycleListeners.forEach((listener) => listener(lifecycle));
}

export const getDesktopBridgeState = () => lifecycle;
export const subscribeDesktopBridge = (listener) => {
  lifecycleListeners.add(listener);
  return () => lifecycleListeners.delete(listener);
};

function openContext(context) {
  if (!context) return;
  const uid = useAuth.getState().user?.uid;
  if (!uid || getStorageOwner() !== uid) {
    pendingContext = context;
    return;
  }
  pendingContext = null;
  if (context === "focus") {
    useFocusSurface.getState().openFor(null);
  } else if (context === "quick-note") {
    router.navigate("/plan/notes?capture=1");
  } else if (context === "workout") {
    router.navigate("/workouts/today");
  } else if (["/", "/plan/schedule", "/plan/planner"].includes(context)) {
    router.navigate(context);
  }
}

function flushPending() {
  if (pendingContext) openContext(pendingContext);
}

function canAlert() {
  const uid = useAuth.getState().user?.uid;
  const notifications = useNotifications.getState();
  return Boolean(uid) && uid === getStorageOwner() && uid === notifications.owner && notifications.settings.browserEnabled && !document.hasFocus() && !isWithinQuietHours(new Date(), notifications.settings.quietHours);
}

function watchContextualEvents() {
  const stopWorkout = useWorkout.subscribe((next, previous) => {
    const runner = next.runner;
    const prior = previous.runner;
    if (!next.active || !prior || runner?.version !== WORKOUT_RUNNER_VERSION || prior.version !== WORKOUT_RUNNER_VERSION || !canAlert()) return;
    if (runner.phase === prior.phase && runner.round === prior.round && runner.exerciseIndex === prior.exerciseIndex) return;
    const exercise = next.workout?.exercises?.[runner.exerciseIndex];
    if (!exercise) return;
    const label = runner.phase === "prepare" ? "Get ready" : runner.phase === "rest" ? "Rest" : runner.phase === "finished" ? "Workout complete" : exercise.name;
    void showDesktopNotification({
      id: `workout:${next.startedAt}:${runner.round}:${runner.exerciseIndex}:${runner.phase}`,
      title: "Echelon Workout",
      body: label,
    });
  });

  const stopFocus = useFocus.subscribe((next, previous) => {
    if (previous.owner === next.owner && next.owner === getStorageOwner() && next.owner === useAuth.getState().user?.uid && previous.task && !next.task && next.sessions.length > previous.sessions.length && canAlert()) {
      const session = next.sessions.at(-1);
      void showDesktopNotification({ id: `focus:${session.id}`, title: "Echelon Focus", body: "Focus session saved" });
    }
  });
  return () => { stopWorkout(); stopFocus(); };
}

async function cleanupBridge() {
  const tasks = cleanupTasks;
  cleanupTasks = [];
  for (const cleanup of tasks.reverse()) {
    try { await cleanup(); } catch { /* Best-effort cleanup before retry. */ }
  }
}

async function initializeBridge() {
  const cleanups = [];
  cleanupTasks = cleanups;
  const { listen } = await import("@tauri-apps/api/event");
  cleanups.push(await listen("desktop://open", async ({ payload }) => {
    await restoreDesktopWindow();
    openContext(payload);
  }));
  cleanups.push(await listen("desktop://notifications-paused", ({ payload }) => updateDesktopPause(payload)));
  cleanups.push(await listen("desktop://wake", () => window.dispatchEvent(new Event(DESKTOP_WAKE_EVENT))));
  cleanups.push(useAuth.subscribe(flushPending));
  cleanups.push(subscribeStorageOwner(flushPending));
  cleanups.push(watchContextualEvents());

  const onWindowFocus = () => {
    void refreshDesktopPermission().then((permission) => useNotifications.setState({ permission }));
  };
  window.addEventListener("focus", onWindowFocus);
  cleanups.push(() => window.removeEventListener("focus", onWindowFocus));

  try { updateDesktopPause(await readDesktopPause()); } catch { /* Tray remains usable; Settings reports operation errors. */ }
  useNotifications.setState({ permission: await refreshDesktopPermission() });
  cleanups.push(await registerQuickNoteShortcut(async () => {
    await restoreDesktopWindow();
    openContext("quick-note");
  }));
}

export function startDesktopBridge() {
  if (!isDesktop()) return Promise.resolve(false);
  if (lifecycle.status === "ready") return Promise.resolve(true);
  if (startPromise) return startPromise;

  setLifecycle("starting");
  startPromise = (async () => {
    await cleanupBridge();
    try {
      await initializeBridge();
      setLifecycle("ready");
      return true;
    } catch (error) {
      await cleanupBridge();
      setLifecycle("failed", error?.message || "Desktop integration could not start.");
      return false;
    } finally {
      startPromise = null;
    }
  })();
  return startPromise;
}

export async function retryDesktopBridge() {
  if (!isDesktop()) return false;
  if (startPromise) return startPromise;
  await cleanupBridge();
  setLifecycle("idle");
  return startDesktopBridge();
}
