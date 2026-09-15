import { filterTransactions, isValidMoneyDate } from "./transactions.js";

export function aggregateLedger(transactions, month = "all") {
  const filtered = filterTransactions(transactions, { month });
  const totals = filtered.reduce(
    (result, transaction) => {
      if (transaction.type === "income") result.incomeMinor += transaction.amountMinor;
      if (transaction.type === "expense") result.expenseMinor += transaction.amountMinor;
      return result;
    },
    { incomeMinor: 0, expenseMinor: 0 },
  );

  return {
    ...totals,
    netMinor: totals.incomeMinor - totals.expenseMinor,
  };
}

export function spendingByCategory(transactions, month = "all") {
  const totals = new Map();
  filterTransactions(transactions, { month, type: "expense" }).forEach(
    (transaction) => {
      totals.set(
        transaction.categoryId,
        (totals.get(transaction.categoryId) ?? 0) + transaction.amountMinor,
      );
    },
  );

  return [...totals.entries()]
    .map(([categoryId, amountMinor]) => ({ categoryId, amountMinor }))
    .sort(
      (first, second) =>
        second.amountMinor - first.amountMinor ||
        first.categoryId.localeCompare(second.categoryId),
    );
}

export function monthlyLedger(transactions) {
  const months = new Map();
  transactions.forEach((transaction) => {
    if (!isValidMoneyDate(transaction.date)) return;
    const month = transaction.date.slice(0, 7);
    const current = months.get(month) ?? {
      month,
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
    };
    if (transaction.type === "income") current.incomeMinor += transaction.amountMinor;
    if (transaction.type === "expense") current.expenseMinor += transaction.amountMinor;
    current.netMinor = current.incomeMinor - current.expenseMinor;
    months.set(month, current);
  });

  return [...months.values()].sort((first, second) =>
    first.month.localeCompare(second.month),
  );
}
