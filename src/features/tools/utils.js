const ID_PATTERN = /^[a-zA-Z0-9:_-]+$/;

export function isValidToolsId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function normalizeToolsTimestamp(value) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function createToolsId(prefix, cryptoApi = globalThis.crypto) {
  const uuid = cryptoApi?.randomUUID?.();
  if (typeof uuid === "string" && uuid) return `${prefix}:${uuid}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
