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

export function createEmptyMoneyDocument() {
  return {
    version: MONEY_VERSION,
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
    transactions,
    categories,
    budgets: normalizeBudgets(value.budgets, categories),
    goals: normalizeGoals(value.goals),
  };
}

export function loadMoneyDocument() {
  return normalizeMoneyDocument(loadData(MONEY_STORAGE_KEY, null));
}

export function saveMoneyDocument(value) {
  const document = normalizeMoneyDocument(value);
  return saveData(MONEY_STORAGE_KEY, document) ? document : null;
}
