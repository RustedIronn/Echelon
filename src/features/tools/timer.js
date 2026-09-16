export const IDLE_TIMER = Object.freeze({
  status: "idle",
  durationMs: 0,
  startedAt: null,
  resumedAt: null,
  accumulatedMs: 0,
});

const validNow = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function startAwarenessTimer(minutes, now = new Date()) {
  const date = validNow(now);
  const numericMinutes = Number(minutes);
  const durationMs = numericMinutes * 60_000;
  if (!date || !Number.isSafeInteger(durationMs) || durationMs <= 0) {
    return IDLE_TIMER;
  }
  if (!Number.isInteger(numericMinutes)) return IDLE_TIMER;
  const timestamp = date.toISOString();
  return {
    status: "running",
    durationMs,
    startedAt: timestamp,
    resumedAt: timestamp,
    accumulatedMs: 0,
  };
}

export function deriveAwarenessTimer(timer, now = new Date()) {
  const date = validNow(now);
  if (!date || !timer || timer.status === "idle") {
    return { elapsedMs: 0, remainingMs: 0, targetEnd: null, finished: false };
  }
  const resumedAt = validNow(timer.resumedAt);
  const runningMs =
    timer.status === "running" && resumedAt
      ? Math.max(0, date.getTime() - resumedAt.getTime())
      : 0;
  const elapsedMs = Math.min(
    timer.durationMs,
    Math.max(0, timer.accumulatedMs + runningMs),
  );
  const remainingMs = Math.max(0, timer.durationMs - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    targetEnd:
      timer.status === "running" && resumedAt
        ? new Date(
            resumedAt.getTime() +
              Math.max(0, timer.durationMs - timer.accumulatedMs),
          ).toISOString()
        : null,
    finished: remainingMs === 0,
  };
}

export function pauseAwarenessTimer(timer, now = new Date()) {
  const date = validNow(now);
  if (!date || timer?.status !== "running") return timer;
  const derived = deriveAwarenessTimer(timer, date);
  return {
    ...timer,
    status: derived.finished ? "finished" : "paused",
    resumedAt: null,
    accumulatedMs: derived.elapsedMs,
  };
}

export function resumeAwarenessTimer(timer, now = new Date()) {
  const date = validNow(now);
  if (!date || timer?.status !== "paused") return timer;
  return { ...timer, status: "running", resumedAt: date.toISOString() };
}

export function finishAwarenessTimer(timer, now = new Date()) {
  const date = validNow(now);
  if (!date || !timer || timer.status === "idle" || timer.status === "finished") return timer;
  const derived = deriveAwarenessTimer(timer, date);
  return {
    ...timer,
    status: "finished",
    resumedAt: null,
    accumulatedMs: derived.elapsedMs,
  };
}

export function resetAwarenessTimer() {
  return IDLE_TIMER;
}
