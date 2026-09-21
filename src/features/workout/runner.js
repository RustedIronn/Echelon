export const WORKOUT_RUNNER_VERSION = 3;
const PREPARE_SECONDS = 5;

const MODES = new Set(["timed", "hold", "duration", "manual"]);
const iso = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const seconds = (value) => Number.isInteger(value) && value >= 0 ? value : null;
const occurrenceKey = (round, exerciseId) => `${round}:${exerciseId}`;

export function normalizeRunnerWorkout(workout) {
  if (!workout || typeof workout.title !== "string" || !workout.title.trim() || !Array.isArray(workout.exercises) || !workout.exercises.length || !Number.isInteger(workout.rounds) || workout.rounds < 1) return null;
  const exercises = workout.exercises.map((exercise, index) => {
    const mode = MODES.has(exercise?.mode) ? exercise.mode : "timed";
    const workSeconds = seconds(exercise?.workSeconds ?? exercise?.duration);
    const restSeconds = seconds(exercise?.restSeconds ?? exercise?.rest ?? 0);
    if (!exercise || typeof exercise.name !== "string" || !exercise.name.trim() || restSeconds === null || (mode !== "manual" && (workSeconds === null || workSeconds === 0))) return null;
    return {
      ...exercise,
      id: typeof exercise.id === "string" && exercise.id.trim() ? exercise.id.trim() : `${typeof workout.day === "string" ? workout.day : "plan"}:${index}`,
      mode,
      workSeconds: mode === "manual" ? null : workSeconds,
      restSeconds,
      instructions: typeof exercise.instructions === "string" ? exercise.instructions : typeof exercise.description === "string" ? exercise.description : "",
      // Existing plan previews still consume these names; new runner timing uses workSeconds/restSeconds.
      duration: mode === "manual" ? 0 : workSeconds,
      rest: restSeconds,
    };
  });
  if (exercises.some((exercise) => !exercise) || new Set(exercises.map((exercise) => exercise.id)).size !== exercises.length) return null;
  const expectedDurationSeconds = exercises.every((exercise) => exercise.workSeconds !== null)
    ? exercises.reduce((sum, exercise) => sum + PREPARE_SECONDS + exercise.workSeconds + exercise.restSeconds, 0) * workout.rounds - exercises.at(-1).restSeconds
    : null;
  return { ...workout, title: workout.title.trim(), description: typeof workout.description === "string" ? workout.description : "", exercises, expectedDurationSeconds };
}

export function createWorkoutRunner(workout, now = new Date()) {
  const plan = normalizeRunnerWorkout(workout);
  const startedAt = iso(now);
  if (!plan || !startedAt) return null;
  return {
    version: WORKOUT_RUNNER_VERSION,
    round: 1,
    exerciseIndex: 0,
    phase: "prepare",
    phaseStartedAt: startedAt,
    remainingMs: PREPARE_SECONDS * 1000,
    elapsedMs: 0,
    activeStartedAt: startedAt,
    paused: false,
    completed: [],
    skipped: [],
    difficulty: null,
    note: "",
    finishedAt: null,
  };
}

export function normalizeWorkoutRunner(value, workout) {
  const plan = normalizeRunnerWorkout(workout);
  if (!plan || value?.version !== WORKOUT_RUNNER_VERSION || !["prepare", "work", "rest", "finished"].includes(value.phase) || !Number.isInteger(value.round) || value.round < 1 || value.round > plan.rounds || !Number.isInteger(value.exerciseIndex) || value.exerciseIndex < 0 || value.exerciseIndex >= plan.exercises.length || typeof value.paused !== "boolean" || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0) return null;
  const exercise = plan.exercises[value.exerciseIndex];
  const remainingMs = value.remainingMs === null && exercise.mode === "manual" && value.phase === "work"
    ? null : Number.isFinite(value.remainingMs) && value.remainingMs >= 0 ? value.remainingMs : undefined;
  if (remainingMs === undefined) return null;
  const phaseStartedAt = value.phaseStartedAt == null ? null : iso(value.phaseStartedAt);
  const activeStartedAt = value.activeStartedAt == null ? null : iso(value.activeStartedAt);
  if (value.phase === "finished" ? (phaseStartedAt || activeStartedAt) : value.paused ? (phaseStartedAt || activeStartedAt) : (!phaseStartedAt || !activeStartedAt)) return null;
  const allowed = new Set(Array.from({ length: plan.rounds }, (_, round) => plan.exercises.map((item) => occurrenceKey(round + 1, item.id))).flat());
  const normalizeEvents = (items) => Array.isArray(items) ? items.filter((item) => allowed.has(item?.key) && iso(item.at)).map((item) => ({ key: item.key, at: iso(item.at) })) : [];
  const seen = new Set();
  const completed = normalizeEvents(value.completed).filter((item) => !seen.has(item.key) && Boolean(seen.add(item.key)));
  const skipped = normalizeEvents(value.skipped).filter((item) => !seen.has(item.key) && Boolean(seen.add(item.key)));
  return {
    version: WORKOUT_RUNNER_VERSION,
    round: value.round,
    exerciseIndex: value.exerciseIndex,
    phase: value.phase,
    phaseStartedAt,
    remainingMs,
    elapsedMs: Math.round(value.elapsedMs),
    activeStartedAt,
    paused: value.phase === "finished" ? false : value.paused,
    completed,
    skipped,
    difficulty: Number.isInteger(value.difficulty) && value.difficulty >= 1 && value.difficulty <= 5 ? value.difficulty : null,
    note: typeof value.note === "string" ? value.note.slice(0, 1000) : "",
    finishedAt: value.phase === "finished" ? iso(value.finishedAt) : null,
  };
}

const hasNext = (runner, plan) => runner.exerciseIndex < plan.exercises.length - 1 || runner.round < plan.rounds;
const nextPosition = (runner, plan) => runner.exerciseIndex < plan.exercises.length - 1
  ? { round: runner.round, exerciseIndex: runner.exerciseIndex + 1 }
  : { round: runner.round + 1, exerciseIndex: 0 };

function enterNext(runner, plan, at) {
  if (!hasNext(runner, plan)) return { ...runner, phase: "finished", phaseStartedAt: null, activeStartedAt: null, remainingMs: 0, paused: false, finishedAt: at };
  const position = nextPosition(runner, plan);
  return { ...runner, ...position, phase: "prepare", phaseStartedAt: at, remainingMs: PREPARE_SECONDS * 1000 };
}

function finishCurrent(runner, plan, at, skipped = false) {
  const key = occurrenceKey(runner.round, plan.exercises[runner.exerciseIndex].id);
  const field = skipped ? "skipped" : "completed";
  const recorded = runner[field].some((item) => item.key === key) ? runner[field] : [...runner[field], { key, at }];
  const result = { ...runner, [field]: recorded };
  const restSeconds = plan.exercises[runner.exerciseIndex].restSeconds;
  return !skipped && restSeconds > 0 && hasNext(runner, plan)
    ? { ...result, phase: "rest", phaseStartedAt: at, remainingMs: restSeconds * 1000 }
    : enterNext(result, plan, at);
}

export function advanceWorkoutRunner(value, workout, now = new Date()) {
  const plan = normalizeRunnerWorkout(workout);
  const runner = normalizeWorkoutRunner(value, plan);
  const requestedTime = new Date(now).getTime();
  if (!runner || !Number.isFinite(requestedTime) || runner.paused || runner.phase === "finished") return runner ?? value;
  const time = Math.max(requestedTime, Date.parse(runner.phaseStartedAt), Date.parse(runner.activeStartedAt));
  let next = runner;
  const maxTransitions = plan.rounds * plan.exercises.length * 3 + 1;
  for (let index = 0; index < maxTransitions && next.phase !== "finished" && next.remainingMs !== null; index++) {
    const deadline = Date.parse(next.phaseStartedAt) + next.remainingMs;
    if (time < deadline) break;
    const elapsedMs = next.elapsedMs + Math.max(0, deadline - Date.parse(next.activeStartedAt));
    const at = new Date(deadline).toISOString();
    next = { ...next, elapsedMs, activeStartedAt: at, phaseStartedAt: at, remainingMs: 0 };
    if (next.phase === "prepare") {
      const exercise = plan.exercises[next.exerciseIndex];
      next = { ...next, phase: "work", remainingMs: exercise.workSeconds === null ? null : exercise.workSeconds * 1000 };
    } else {
      next = next.phase === "work" ? finishCurrent(next, plan, at) : enterNext(next, plan, at);
    }
  }
  if (next.phase === "finished") return next;
  const elapsedMs = next.elapsedMs + Math.max(0, time - Date.parse(next.activeStartedAt));
  const remainingMs = next.remainingMs === null ? null : Math.max(0, next.remainingMs - Math.max(0, time - Date.parse(next.phaseStartedAt)));
  return { ...next, elapsedMs, activeStartedAt: new Date(time).toISOString(), phaseStartedAt: new Date(time).toISOString(), remainingMs };
}

export function pauseWorkoutRunner(value, workout, now = new Date()) {
  const current = advanceWorkoutRunner(value, workout, now);
  if (!current || current.paused || current.phase === "finished") return current;
  return { ...current, paused: true, activeStartedAt: null, phaseStartedAt: null };
}

export function resumeWorkoutRunner(value, workout, now = new Date()) {
  const current = normalizeWorkoutRunner(value, workout);
  const at = iso(now);
  if (!current || !current.paused || current.phase === "finished" || !at) return current ?? value;
  return { ...current, paused: false, activeStartedAt: at, phaseStartedAt: at };
}

export function restorePausedWorkoutRunner(value, workout) {
  const current = normalizeWorkoutRunner(value, workout);
  if (!current || current.phase === "finished") return current;
  return { ...current, paused: true, phaseStartedAt: null, activeStartedAt: null };
}

export function completeRunnerExercise(value, workout, now = new Date(), skip = false, expectedKey = null) {
  const current = advanceWorkoutRunner(value, workout, now);
  const plan = normalizeRunnerWorkout(workout);
  if (!current || !plan || current.paused || current.phase !== "work" || (expectedKey && occurrenceKey(current.round, plan.exercises[current.exerciseIndex].id) !== expectedKey)) return current ?? value;
  const at = iso(now);
  return finishCurrent(current, plan, at, skip);
}

export function skipRunnerRest(value, workout, now = new Date(), expectedKey = null) {
  const current = advanceWorkoutRunner(value, workout, now);
  const plan = normalizeRunnerWorkout(workout);
  if (!current || !plan || current.paused || current.phase !== "rest" || (expectedKey && occurrenceKey(current.round, plan.exercises[current.exerciseIndex].id) !== expectedKey)) return current ?? value;
  return enterNext(current, plan, iso(now));
}

export function updateRunnerReflection(value, patch) {
  if (!value || value.version !== WORKOUT_RUNNER_VERSION) return value;
  const difficulty = patch.difficulty === null ? null : Number(patch.difficulty);
  if (patch.difficulty !== undefined && difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) return value;
  return {
    ...value,
    difficulty: patch.difficulty === undefined ? value.difficulty : difficulty,
    note: patch.note === undefined ? value.note : typeof patch.note === "string" ? patch.note.slice(0, 1000) : value.note,
  };
}

export function runnerStateFields(runner) {
  return {
    runner,
    round: runner.round,
    exerciseIndex: runner.exerciseIndex,
    phase: runner.phase === "work" ? "exercise" : runner.phase,
    seconds: runner.remainingMs === null ? 0 : Math.ceil(runner.remainingMs / 1000),
    elapsed: Math.floor(runner.elapsedMs / 1000),
    paused: runner.paused,
    active: runner.phase !== "finished",
  };
}

export function completedRunnerSummary(runner, workout) {
  const plan = normalizeRunnerWorkout(workout);
  if (!plan || runner?.version !== WORKOUT_RUNNER_VERSION || runner.phase !== "finished") return null;
  const names = new Map(plan.exercises.map((exercise) => [exercise.id, exercise.name]));
  const completedKeys = new Set(runner.completed.map((item) => item.key));
  const roundsCompleted = Array.from({ length: plan.rounds }, (_, index) => index + 1)
    .filter((round) => plan.exercises.every((exercise) => completedKeys.has(occurrenceKey(round, exercise.id)))).length;
  const describe = (items) => items.map((item) => {
    const separator = item.key.indexOf(":");
    const round = Number(item.key.slice(0, separator));
    const exerciseId = item.key.slice(separator + 1);
    return { round, exerciseId, name: names.get(exerciseId), at: item.at };
  }).filter((item) => item.name);
  return {
    version: WORKOUT_RUNNER_VERSION,
    roundsCompleted,
    completed: describe(runner.completed),
    skipped: describe(runner.skipped),
    difficulty: runner.difficulty,
    note: runner.note,
  };
}

export function normalizeCompletedRunnerSummary(value) {
  if (value?.version !== WORKOUT_RUNNER_VERSION || !Number.isInteger(value.roundsCompleted) || value.roundsCompleted < 0 || !Array.isArray(value.completed) || !Array.isArray(value.skipped)) return null;
  const normalizeItems = (items) => items.filter((item) => Number.isInteger(item?.round) && item.round > 0 && typeof item.exerciseId === "string" && item.exerciseId && typeof item.name === "string" && item.name.trim() && iso(item.at)).map((item) => ({ round: item.round, exerciseId: item.exerciseId, name: item.name, at: iso(item.at) }));
  const completed = normalizeItems(value.completed);
  const skipped = normalizeItems(value.skipped);
  if (completed.length !== value.completed.length || skipped.length !== value.skipped.length) return null;
  return {
    version: WORKOUT_RUNNER_VERSION,
    roundsCompleted: value.roundsCompleted,
    completed,
    skipped,
    difficulty: Number.isInteger(value.difficulty) && value.difficulty >= 1 && value.difficulty <= 5 ? value.difficulty : null,
    note: typeof value.note === "string" ? value.note.slice(0, 1000) : "",
  };
}
