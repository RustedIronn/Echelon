import { getScheduleMinutes } from "./scheduleTime.js";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function randomFor(seed) {
  let value = hash(seed);
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothPath(points) {
  if (points.length < 2) return "";

  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const controlOne = {
      x: point.x + (next.x - previous.x) / 6,
      y: point.y + (next.y - previous.y) / 6,
    };
    const controlTwo = {
      x: next.x - (after.x - point.x) / 6,
      y: next.y - (after.y - point.y) / 6,
    };

    return `${path} C ${controlOne.x.toFixed(1)} ${controlOne.y.toFixed(1)}, ${controlTwo.x.toFixed(1)} ${controlTwo.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }, `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
}

function localDayKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}

// The field is deterministic for a local day. It intentionally uses only bounded
// variation so a schedule remains readable while avoiding a rigid time-grid.
export function createScheduleField(tasks, date, availableWidth) {
  const width = Math.max(280, Math.round(availableWidth || 960));
  const compact = width < 680;
  const firstMinute = tasks.length ? getScheduleMinutes(tasks[0].start) : 0;
  const lastMinute = tasks.length ? getScheduleMinutes(tasks.at(-1).end) : firstMinute + 1;
  const span = Math.max(1, lastMinute - firstMinute);
  const minimumStep = compact ? 122 : 118;
  const chronologicalHeight = Math.max(
    tasks.length * minimumStep,
    520,
    Math.round(span * (compact ? 0.43 : 0.35)),
  );
  const key = localDayKey(date);
  const stemCenter = compact ? 34 : width * 0.5;
  const stemWander = compact ? 6 : clamp(width * 0.045, 24, 46);
  let previousY = 26 - minimumStep;
  let previousSide = randomFor(`${key}:origin`)() > 0.5 ? "right" : "left";

  const events = tasks.map((task, index) => {
    const random = randomFor(`${key}:${task.id}:${index}`);
    const projectedY = 56 + ((getScheduleMinutes(task.start) - firstMinute) / span) * chronologicalHeight;
    const y = Math.max(projectedY, previousY + minimumStep + random() * 12);
    previousY = y;

    const stemX = clamp(
      stemCenter + (random() - 0.5) * stemWander * 2 + Math.sin(index * 1.7) * stemWander * 0.38,
      compact ? 26 : width * 0.4,
      compact ? 46 : width * 0.6,
    );
    const side = compact ? "right" : (previousSide === "left" ? "right" : "left");
    previousSide = side;
    const contentWidth = compact
      ? width - 82
      : clamp(width * 0.31 + (random() - 0.5) * 34, 220, 350);
    const contentX = compact
      ? 64
      : side === "left"
        ? 18 + random() * 18
        : width - contentWidth - 20 - random() * 18;
    const branchEndX = side === "left" ? contentX + contentWidth + 12 : contentX - 12;
    const branchDirection = Math.sign(branchEndX - stemX) || 1;
    const bend = compact ? 14 : clamp(Math.abs(branchEndX - stemX) * 0.38, 42, 92);
    const branchPath = `M ${stemX.toFixed(1)} ${y.toFixed(1)} C ${(stemX + branchDirection * bend).toFixed(1)} ${(y + (random() - 0.5) * 18).toFixed(1)}, ${(branchEndX - branchDirection * bend * 0.42).toFixed(1)} ${(y + (random() - 0.5) * 14).toFixed(1)}, ${branchEndX.toFixed(1)} ${y.toFixed(1)}`;

    return {
      task,
      x: contentX,
      y,
      width: contentWidth,
      stemX,
      branchPath,
      side,
    };
  });

  const stemPoints = [
    { x: stemCenter, y: 18 },
    ...events.map(({ stemX, y }) => ({ x: stemX, y })),
    { x: events.at(-1)?.stemX ?? stemCenter, y: (events.at(-1)?.y ?? 24) + 72 },
  ];

  return {
    width,
    height: Math.max(300, (events.at(-1)?.y ?? 0) + 84),
    compact,
    stemPath: smoothPath(stemPoints),
    events,
  };
}
