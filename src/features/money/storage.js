import { loadData, saveData } from "../../shared/storage.js";
import {
  DEFAULT_CATEGORIES,
  MONEY_STORAGE_KEY,
  MONEY_VERSION,
} from "./constants.js";
import { normalizeBudgets } from "./budgets.js";
import { normalizeCategories } from "./categories.js";
import { normalizeGoals } from "./goals.js";
import { normalizeTransaction } from "./transactions.js";
import { createNextRevision, getRevision } from "../../shared/versionedState.js";

const normalizeUpdatedAt = (value) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
};

const sameFields = (left, right, fields) =>
  fields.every((field) => left?.[field] === right?.[field]);

const sameRecords = (left, right, fields) =>
  left.length === right.length &&
  left.every((item, index) => sameFields(item, right[index], fields));

const isCanonicalMoneySource = (value, document) =>
  sameRecords(value.transactions, document.transactions, [
    "id",
    "type",
    "amountMinor",
    "categoryId",
    "description",
    "date",
    "recurring",
    "createdAt",
    "updatedAt",
  ]) &&
  sameRecords(value.categories, document.categories, ["id", "name", "type"]) &&
  sameRecords(value.budgets, document.budgets, [
    "id",
    "categoryId",
    "monthlyLimitMinor",
  ]) &&
  sameRecords(value.goals, document.goals, [
    "id",
    "name",
    "targetAmountMinor",
    "savedAmountMinor",
    "targetDate",
    "createdAt",
    "updatedAt",
  ]);

const getMonotonicTimestamp = (current, now) => {
  const candidate = now instanceof Date ? now : new Date(now);
  const candidateTime = candidate.getTime();
  const fallbackTime = Date.now();
  const currentTime = Date.parse(current?.updatedAt);
  const validCandidate = Number.isNaN(candidateTime) ? fallbackTime : candidateTime;

  if (Number.isNaN(currentTime) || validCandidate > currentTime) {
    return new Date(validCandidate);
  }

  return new Date(Math.min(currentTime + 1, 8_640_000_000_000_000));
};

export function createEmptyMoneyDocument() {
  return {
    version: MONEY_VERSION,
    revision: 0,
    updatedAt: null,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    budgets: [],
    goals: [],
  };
}

export function normalizeMoneyDocument(value) {
  if (!value || value.version !== MONEY_VERSION) return createEmptyMoneyDocument();

  const categories = normalizeCategories(value.categories);
  const transactions = [];
  const seenTransactionIds = new Set();
  if (Array.isArray(value.transactions)) {
    value.transactions.forEach((item) => {
      const transaction = normalizeTransaction(item, categories);
      if (!transaction || seenTransactionIds.has(transaction.id)) return;
      seenTransactionIds.add(transaction.id);
      transactions.push(transaction);
    });
  }

  return {
    version: MONEY_VERSION,
    revision: getRevision(value),
    updatedAt: normalizeUpdatedAt(value.updatedAt),
    transactions,
    categories,
    budgets: normalizeBudgets(value.budgets, categories),
    goals: normalizeGoals(value.goals),
  };
}

export function normalizeMoneyCloudDocument(value) {
  const hasValidMetadata =
    Number.isInteger(value?.revision) &&
    value.revision >= 0 &&
    (value.revision === 0
      ? value.updatedAt === null
      : normalizeUpdatedAt(value.updatedAt) === value.updatedAt);

  if (
    value?.version !== MONEY_VERSION ||
    !hasValidMetadata ||
    !Array.isArray(value.transactions) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.budgets) ||
    !Array.isArray(value.goals)
  ) {
    return null;
  }

  const document = normalizeMoneyDocument(value);
  return isCanonicalMoneySource(value, document) ? document : null;
}

export function selectMoneySource(document) {
  return {
    version: MONEY_VERSION,
    transactions: document.transactions,
    categories: document.categories,
    budgets: document.budgets,
    goals: document.goals,
  };
}

export function hasMoneySourceData(value) {
  const document = normalizeMoneyDocument(value);
  const hasCustomCategories =
    document.categories.length !== DEFAULT_CATEGORIES.length ||
    document.categories.some((category, index) => {
      const defaultCategory = DEFAULT_CATEGORIES[index];
      return (
        category.id !== defaultCategory?.id ||
        category.name !== defaultCategory?.name ||
        category.type !== defaultCategory?.type
      );
    });

  return (
    document.revision > 0 ||
    document.updatedAt !== null ||
    document.transactions.length > 0 ||
    document.budgets.length > 0 ||
    document.goals.length > 0 ||
    hasCustomCategories
  );
}

export function createNextMoneyDocument(document, current, now = new Date()) {
  return normalizeMoneyDocument(
    createNextRevision(
      selectMoneySource(document),
      current,
      getMonotonicTimestamp(current, now),
    ),
  );
}

export function loadMoneyDocument() {
  return normalizeMoneyDocument(loadData(MONEY_STORAGE_KEY, null));
}

export function loadMoneyDocumentForSync() {
  const value = loadData(MONEY_STORAGE_KEY, null);
  if (!value) return null;

  const document = normalizeMoneyDocument(value);
  return hasMoneySourceData(document) ? document : null;
}

export function saveMoneyDocument(value) {
  const document = normalizeMoneyDocument(value);
  return saveData(MONEY_STORAGE_KEY, document) ? document : null;
}
