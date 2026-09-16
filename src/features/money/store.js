import { create } from "zustand";

import {
  getStorageOwner,
  subscribeStorageOwner,
} from "../../shared/storage.js";
import { addCustomCategory, deleteCustomCategory } from "./categories.js";
import { deleteBudget, setMonthlyBudget } from "./budgets.js";
import { addGoal, createGoal, deleteGoal, editGoal } from "./goals.js";
import {
  createNextMoneyDocument,
  loadMoneyDocument,
  loadMoneyDocumentForSync,
  saveMoneyDocument,
} from "./storage.js";
import { queueMoneyMutation } from "./syncRuntime.js";
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

const commit = (set, current, changes, now = new Date()) => {
  const data = persist(
    createNextMoneyDocument({ ...current, ...changes }, current, now),
  );
  if (!data) return false;

  const owner = getStorageOwner();
  set({ data, syncStatus: "pending", syncError: null });
  queueMoneyMutation(owner, data);
  return true;
};

export const useMoney = create((set, get) => ({
  owner: getStorageOwner(),
  data: loadMoneyDocument(),
  syncStatus: "idle",
  syncError: null,

  addTransaction: (input, metadata = {}) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const transaction = createTransaction(input, current.categories, {
      id: metadata.id ?? createMoneyId("transaction"),
      now: metadata.now,
    });
    const transactions = addTransaction(current.transactions, transaction);
    if (transactions === current.transactions) return false;

    return commit(set, current, { transactions }, metadata.now);
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

    return commit(set, current, { transactions }, now);
  },

  deleteTransaction: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const transactions = deleteTransaction(current.transactions, id);
    if (transactions === current.transactions) return false;
    return commit(set, current, { transactions });
  },

  addCategory: (input, id = createMoneyId("category")) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const categories = addCustomCategory(current.categories, input, id);
    if (categories === current.categories) return false;
    return commit(set, current, { categories });
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
    return commit(set, current, { categories });
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
    return commit(set, current, { budgets });
  },

  deleteBudget: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const budgets = deleteBudget(current.budgets, id);
    if (budgets === current.budgets) return false;
    return commit(set, current, { budgets });
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
    return commit(set, current, { goals }, metadata.now);
  },

  editGoal: (id, patch, now = new Date()) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const goals = editGoal(current.goals, id, patch, now);
    if (goals === current.goals) return false;
    return commit(set, current, { goals }, now);
  },

  deleteGoal: (id) => {
    const current = getOwnedData(get);
    if (!current) return false;
    const goals = deleteGoal(current.goals, id);
    if (goals === current.goals) return false;
    return commit(set, current, { goals });
  },
}));

export function getOwnedMoneyDocument(uid) {
  const state = useMoney.getState();
  return getStorageOwner() === uid && state.owner === uid
    ? loadMoneyDocumentForSync()
    : null;
}

export function applyMoneyCloudDocument(uid, document) {
  if (getStorageOwner() !== uid || useMoney.getState().owner !== uid) {
    return false;
  }
  const data = persist(document);
  if (!data || getStorageOwner() !== uid || useMoney.getState().owner !== uid) {
    return false;
  }
  useMoney.setState({ data, syncStatus: "synced", syncError: null });
  return true;
}

export function setMoneySyncStatus(uid, syncStatus, error = null) {
  if (getStorageOwner() !== uid || useMoney.getState().owner !== uid) {
    return false;
  }
  useMoney.setState({
    syncStatus,
    syncError: error instanceof Error ? error.message : null,
  });
  return true;
}

subscribeStorageOwner(() => {
  useMoney.setState({
    owner: getStorageOwner(),
    data: loadMoneyDocument(),
    syncStatus: "idle",
    syncError: null,
  });
});
