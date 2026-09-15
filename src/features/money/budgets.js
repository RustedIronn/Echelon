import { BUDGET_WARNING_RATIO } from "./constants.js";
import {
  filterTransactions,
  isValidMoneyId,
  parseMoneyToMinor,
} from "./transactions.js";

export function normalizeBudgets(value, categories) {
  if (!Array.isArray(value)) return [];

  const expenseIds = new Set(
    categories
      .filter((category) => category.type === "expense")
      .map((category) => category.id),
  );
  const usedCategories = new Set();

  return value.reduce((budgets, budget) => {
    if (
      !isValidMoneyId(budget?.id) ||
      !expenseIds.has(budget?.categoryId) ||
      usedCategories.has(budget.categoryId) ||
      !Number.isSafeInteger(budget?.monthlyLimitMinor) ||
      budget.monthlyLimitMinor <= 0
    ) {
      return budgets;
    }

    usedCategories.add(budget.categoryId);
    budgets.push({
      id: budget.id,
      categoryId: budget.categoryId,
      monthlyLimitMinor: budget.monthlyLimitMinor,
    });
    return budgets;
  }, []);
}

export function setMonthlyBudget(budgets, categoryId, amount, categories) {
  const category = categories.find(
    (item) => item.id === categoryId && item.type === "expense",
  );
  const monthlyLimitMinor = parseMoneyToMinor(amount);
  if (!category || !monthlyLimitMinor) return budgets;

  const budget = {
    id: `budget:${categoryId}`,
    categoryId,
    monthlyLimitMinor,
  };
  const index = budgets.findIndex((item) => item.categoryId === categoryId);
  if (index === -1) return [...budgets, budget];
  if (budgets[index].monthlyLimitMinor === monthlyLimitMinor) return budgets;

  const next = [...budgets];
  next[index] = budget;
  return next;
}

export function deleteBudget(budgets, id) {
  if (!budgets.some((budget) => budget.id === id)) return budgets;
  return budgets.filter((budget) => budget.id !== id);
}

export function calculateBudgetUsage(budget, transactions, month) {
  const spentMinor = filterTransactions(transactions, {
    month,
    type: "expense",
    categoryId: budget.categoryId,
  }).reduce((total, transaction) => total + transaction.amountMinor, 0);
  const remainingMinor = budget.monthlyLimitMinor - spentMinor;
  const ratio = spentMinor / budget.monthlyLimitMinor;
  const status =
    ratio > 1 ? "over" : ratio >= BUDGET_WARNING_RATIO ? "warning" : "normal";

  return {
    ...budget,
    spentMinor,
    remainingMinor,
    ratio,
    percent: Math.max(0, Math.round(ratio * 100)),
    visualPercent: Math.min(100, Math.max(0, ratio * 100)),
    status,
  };
}
