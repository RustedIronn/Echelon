import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_IDS,
  TRANSACTION_TYPES,
} from "./constants.js";
import { isValidMoneyId } from "./transactions.js";

const typeSet = new Set(TRANSACTION_TYPES);

const normalizeCategory = (value) => {
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!isValidMoneyId(value?.id) || !name || !typeSet.has(value?.type)) {
    return null;
  }
  return { id: value.id, name, type: value.type };
};

export function normalizeCategories(value) {
  const categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  const usedIds = new Set(categories.map((category) => category.id));

  if (!Array.isArray(value)) return categories;
  value.forEach((item) => {
    const category = normalizeCategory(item);
    if (!category || usedIds.has(category.id)) return;
    usedIds.add(category.id);
    categories.push(category);
  });
  return categories;
}

export function addCustomCategory(categories, input, id) {
  const category = normalizeCategory({ ...input, id });
  if (
    !category ||
    categories.some(
      (item) =>
        item.id === category.id ||
        (item.type === category.type &&
          item.name.toLowerCase() === category.name.toLowerCase()),
    )
  ) {
    return categories;
  }
  return [...categories, category];
}

export function getCategoryDeletionState(
  categoryId,
  transactions = [],
  budgets = [],
) {
  if (DEFAULT_CATEGORY_IDS.has(categoryId)) {
    return { allowed: false, reason: "Default categories cannot be deleted." };
  }
  if (transactions.some((transaction) => transaction?.categoryId === categoryId)) {
    return { allowed: false, reason: "Used by an existing transaction." };
  }
  if (budgets.some((budget) => budget?.categoryId === categoryId)) {
    return { allowed: false, reason: "Used by an existing budget." };
  }
  return { allowed: true, reason: "" };
}

export function deleteCustomCategory(categories, categoryId, transactions, budgets) {
  const state = getCategoryDeletionState(categoryId, transactions, budgets);
  if (!state.allowed || !categories.some((item) => item.id === categoryId)) {
    return categories;
  }
  return categories.filter((item) => item.id !== categoryId);
}
