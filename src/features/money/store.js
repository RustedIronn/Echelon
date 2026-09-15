import { create } from "zustand";

import {
  getStorageOwner,
  subscribeStorageOwner,
} from "../../shared/storage.js";
import { addCustomCategory, deleteCustomCategory } from "./categories.js";
import { deleteBudget, setMonthlyBudget } from "./budgets.js";
import { addGoal, createGoal, deleteGoal, editGoal } from "./goals.js";
import { loadMoneyDocument, saveMoneyDocument } from "./storage.js";
import {
  addTransaction,
  createMoneyId,
  createTransaction,
  deleteTransaction,
  editTransaction,
} from "./transactions.js";

const persist = (document) => saveMoneyDocument(document);

const getOwnedData = (get) => {
  const owner = getStorageOwner();
  const state = get();
  return owner && state.owner === owner ? state.data : null;
};

export const useMoney = create((set, get) => ({
  owner: getStorageOwner(),
  data: loadMoneyDocument(),

  addTransaction: (input, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const transaction = createTransaction(input, current.categories, {
      id: metadata.id ?? createMoneyId("transaction"),
      now: metadata.now,
    });
    const transactions = addTransaction(current.transactions, transaction);
    if (transactions === current.transactions) return false;

    const data = persist({ ...current, transactions });
    if (!data) return false;
    set({ data });
    return true;
  },

  editTransaction: (id, patch, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const transactions = editTransaction(
      current.transactions,
      id,
      patch,
      current.categories,
      now,
    );
    if (transactions === current.transactions) return false;

    const data = persist({ ...current, transactions });
    if (!data) return false;
    set({ data });
    return true;
  },

  deleteTransaction: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const transactions = deleteTransaction(current.transactions, id);
    if (transactions === current.transactions) return false;
    const data = persist({ ...current, transactions });
    if (!data) return false;
    set({ data });
    return true;
  },

  addCategory: (input, id = createMoneyId("category")) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const categories = addCustomCategory(current.categories, input, id);
    if (categories === current.categories) return false;
    const data = persist({ ...current, categories });
    if (!data) return false;
    set({ data });
    return true;
  },

  deleteCategory: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const categories = deleteCustomCategory(
      current.categories,
      id,
      current.transactions,
      current.budgets,
    );
    if (categories === current.categories) return false;
    const data = persist({ ...current, categories });
    if (!data) return false;
    set({ data });
    return true;
  },

  setBudget: (categoryId, amount) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const budgets = setMonthlyBudget(
      current.budgets,
      categoryId,
      amount,
      current.categories,
    );
    if (budgets === current.budgets) return false;
    const data = persist({ ...current, budgets });
    if (!data) return false;
    set({ data });
    return true;
  },

  deleteBudget: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const budgets = deleteBudget(current.budgets, id);
    if (budgets === current.budgets) return false;
    const data = persist({ ...current, budgets });
    if (!data) return false;
    set({ data });
    return true;
  },

  addGoal: (input, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const goal = createGoal(input, {
      id: metadata.id ?? createMoneyId("goal"),
      now: metadata.now,
    });
    const goals = addGoal(current.goals, goal);
    if (goals === current.goals) return false;
    const data = persist({ ...current, goals });
    if (!data) return false;
    set({ data });
    return true;
  },

  editGoal: (id, patch, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const goals = editGoal(current.goals, id, patch, now);
    if (goals === current.goals) return false;
    const data = persist({ ...current, goals });
    if (!data) return false;
    set({ data });
    return true;
  },

  deleteGoal: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const goals = deleteGoal(current.goals, id);
    if (goals === current.goals) return false;
    const data = persist({ ...current, goals });
    if (!data) return false;
    set({ data });
    return true;
  },
}));

subscribeStorageOwner(() => {
  useMoney.setState({
    owner: getStorageOwner(),
    data: loadMoneyDocument(),
  });
});
