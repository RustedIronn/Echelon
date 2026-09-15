export const MONEY_VERSION = 1;
export const MONEY_STORAGE_KEY = "echelon_money_v1";

export const TRANSACTION_TYPES = ["expense", "income"];

export const DEFAULT_CATEGORIES = [
  { id: "expense:food", name: "Food", type: "expense" },
  { id: "expense:groceries", name: "Groceries", type: "expense" },
  { id: "expense:transport", name: "Transport", type: "expense" },
  { id: "expense:shopping", name: "Shopping", type: "expense" },
  { id: "expense:entertainment", name: "Entertainment", type: "expense" },
  { id: "expense:subscriptions", name: "Subscriptions", type: "expense" },
  { id: "expense:bills", name: "Bills", type: "expense" },
  { id: "expense:health", name: "Health", type: "expense" },
  { id: "expense:education", name: "Education", type: "expense" },
  { id: "expense:other", name: "Other", type: "expense" },
  { id: "income:allowance", name: "Allowance", type: "income" },
  { id: "income:salary", name: "Salary", type: "income" },
  { id: "income:freelance", name: "Freelance", type: "income" },
  { id: "income:refund", name: "Refund", type: "income" },
  { id: "income:gift", name: "Gift", type: "income" },
  { id: "income:other", name: "Other", type: "income" },
];

export const DEFAULT_CATEGORY_IDS = new Set(
  DEFAULT_CATEGORIES.map((category) => category.id),
);

export const BUDGET_WARNING_RATIO = 0.8;
