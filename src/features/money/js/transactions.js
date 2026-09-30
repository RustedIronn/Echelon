import { isValidDayKey } from "../../../shared/date.js";
import { TRANSACTION_TYPES } from "./constants.js";

const ID_PATTERN = /^[a-zA-Z0-9:_-]+$/;
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const typeSet = new Set(TRANSACTION_TYPES);

export function isValidMoneyId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function parseMoneyToMinor(value) {
  const text = typeof value === "number" ? String(value) : value?.trim?.();
  if (typeof text !== "string" || !MONEY_PATTERN.test(text)) return null;

  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function minorToInput(minor) {
  if (!Number.isSafeInteger(minor) || minor < 0) return "";

  const whole = Math.floor(minor / 100);
  const fraction = String(minor % 100).padStart(2, "0");
  return fraction === "00" ? String(whole) : `${whole}.${fraction}`;
}

export function formatInr(minor) {
  const safeMinor = Number.isSafeInteger(minor) ? minor : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: safeMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safeMinor / 100);
}

const normalizeTimestamp = (value) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

export function createMoneyId(prefix, cryptoApi = globalThis.crypto) {
  const uuid = cryptoApi?.randomUUID?.();
  if (typeof uuid === "string" && uuid) return `${prefix}:${uuid}`;

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function normalizeTransaction(value, categories) {
  const category = Array.isArray(categories)
    ? categories.find((item) => item.id === value?.categoryId)
    : null;
  const createdAt = normalizeTimestamp(value?.createdAt);
  const updatedAt = normalizeTimestamp(value?.updatedAt);

  if (
    !isValidMoneyId(value?.id) ||
    !typeSet.has(value?.type) ||
    !Number.isSafeInteger(value?.amountMinor) ||
    value.amountMinor <= 0 ||
    !category ||
    category.type !== value.type ||
    !isValidDayKey(value?.date) ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    amountMinor: value.amountMinor,
    categoryId: value.categoryId,
    description:
      typeof value.description === "string" ? value.description.trim() : "",
    date: value.date,
    recurring: value.recurring === true,
    createdAt,
    updatedAt,
  };
}

export function createTransaction(input, categories, metadata) {
  const now =
    metadata?.now instanceof Date
      ? metadata.now
      : metadata?.now === undefined
        ? new Date()
        : new Date(metadata.now);
  if (Number.isNaN(now.getTime())) return null;

  return normalizeTransaction(
    {
      id: metadata?.id,
      type: input?.type,
      amountMinor: parseMoneyToMinor(input?.amount),
      categoryId: input?.categoryId,
      description: input?.description,
      date: input?.date,
      recurring: input?.recurring,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    categories,
  );
}

export function addTransaction(transactions, transaction) {
  if (!transaction || transactions.some((item) => item.id === transaction.id)) {
    return transactions;
  }
  return [...transactions, transaction];
}

export function editTransaction(
  transactions,
  id,
  patch,
  categories,
  now = new Date(),
) {
  const index = transactions.findIndex((item) => item.id === id);
  if (index === -1 || !(now instanceof Date) || Number.isNaN(now.getTime())) {
    return transactions;
  }

  const current = transactions[index];
  const updated = normalizeTransaction(
    {
      ...current,
      ...patch,
      id: current.id,
      amountMinor:
        patch.amount === undefined
          ? current.amountMinor
          : parseMoneyToMinor(patch.amount),
      createdAt: current.createdAt,
      updatedAt: now.toISOString(),
    },
    categories,
  );
  if (!updated) return transactions;

  const next = [...transactions];
  next[index] = updated;
  return next;
}

export function deleteTransaction(transactions, id) {
  if (!transactions.some((item) => item.id === id)) return transactions;
  return transactions.filter((item) => item.id !== id);
}

export function sortTransactions(transactions) {
  return [...transactions].sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      second.createdAt.localeCompare(first.createdAt) ||
      first.id.localeCompare(second.id),
  );
}

export function filterTransactions(
  transactions,
  { month = "all", type = "all", categoryId = "all" } = {},
) {
  return sortTransactions(transactions).filter(
    (transaction) =>
      (month === "all" || transaction.date.startsWith(`${month}-`)) &&
      (type === "all" || transaction.type === type) &&
      (categoryId === "all" || transaction.categoryId === categoryId),
  );
}
