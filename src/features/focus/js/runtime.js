const toTimestamp = (value) => {
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const IDLE_FOCUS_RUNTIME = Object.freeze({
  active: false,
  task: null,
  startedAt: null,
  accumulatedMs: 0,
  seconds: 0,
});

export function createFocusOwnerState(owner, sessions = []) {
  return {
    owner,
    ...IDLE_FOCUS_RUNTIME,
    sessions,
  };
}

export function startFocusRuntime(task, now = Date.now()) {
  const timestamp = toTimestamp(now);
  if (!task || timestamp === null) return { ...IDLE_FOCUS_RUNTIME };

  return {
    active: true,
    task,
    startedAt: timestamp,
    accumulatedMs: 0,
    seconds: 0,
  };
}

export function deriveFocusElapsedMs(runtime, now = Date.now()) {
  const accumulatedMs = Number.isFinite(runtime?.accumulatedMs)
    ? Math.max(runtime.accumulatedMs, 0)
    : 0;
  if (!runtime?.active || !Number.isFinite(runtime.startedAt)) {
    return accumulatedMs;
  }

  const timestamp = toTimestamp(now);
  return timestamp === null
    ? accumulatedMs
    : accumulatedMs + Math.max(timestamp - runtime.startedAt, 0);
}

export function deriveFocusElapsedSeconds(runtime, now = Date.now()) {
  return Math.floor(deriveFocusElapsedMs(runtime, now) / 1000);
}

export function refreshFocusRuntime(runtime, now = Date.now()) {
  return {
    ...runtime,
    seconds: deriveFocusElapsedSeconds(runtime, now),
  };
}

export function pauseFocusRuntime(runtime, now = Date.now()) {
  if (!runtime?.active || !runtime.task) return runtime;
  const accumulatedMs = deriveFocusElapsedMs(runtime, now);

  return {
    ...runtime,
    active: false,
    startedAt: null,
    accumulatedMs,
    seconds: Math.floor(accumulatedMs / 1000),
  };
}

export function resumeFocusRuntime(runtime, now = Date.now()) {
  const timestamp = toTimestamp(now);
  if (!runtime?.task || runtime.active || timestamp === null) return runtime;

  return {
    ...runtime,
    active: true,
    startedAt: timestamp,
    seconds: deriveFocusElapsedSeconds(runtime, timestamp),
  };
}

export function finishFocusRuntime(runtime, now = Date.now()) {
  if (!runtime?.task) {
    return {
      completed: false,
      duration: 0,
      task: null,
      runtime: { ...IDLE_FOCUS_RUNTIME },
    };
  }

  const duration = deriveFocusElapsedSeconds(runtime, now);
  return {
    completed: duration > 0,
    duration,
    task: runtime.task,
    runtime: { ...IDLE_FOCUS_RUNTIME },
  };
}
