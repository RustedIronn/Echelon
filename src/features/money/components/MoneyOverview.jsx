import { Link } from "react-router-dom";

import { Card, EmptyState } from "@ui";
import { getToday } from "../../../shared/date.js";
import { aggregateLedger, monthlyLedger, spendingByCategory } from "../analytics.js";
import { calculateBudgetUsage } from "../budgets.js";
import { getGoalProgress } from "../goals.js";
import { useMoney } from "../store.js";
import { formatInr, sortTransactions } from "../transactions.js";

export default function MoneyOverview() {
  const data = useMoney((state) => state.data);
  const month = getToday().slice(0, 7);
  const allTime = aggregateLedger(data.transactions);
  const current = aggregateLedger(data.transactions, month);
  const recent = sortTransactions(data.transactions).slice(0, 5);
  const categoryById = new Map(
    data.categories.map((category) => [category.id, category]),
  );
  const budgets = data.budgets.map((budget) =>
    calculateBudgetUsage(budget, data.transactions, month),
  );
  const goals = data.goals.map(getGoalProgress);
  const months = monthlyLedger(data.transactions).slice(-6).reverse();
  const categories = spendingByCategory(data.transactions, month).slice(0, 5);

  return (
    <div className="stack">
      <div className="money-overview-grid">
        <Card className="money-balance-card">
          <span>Available</span>
          <strong>{formatInr(allTime.netMinor)}</strong>
          <small>Income minus expenses across the full ledger.</small>
        </Card>

        <Card>
          <div className="section-header">
            <h2>This month</h2>
            <p>{month}</p>
          </div>
          <div className="money-summary-list">
            <div><span>Income</span><strong>{formatInr(current.incomeMinor)}</strong></div>
            <div><span>Spent</span><strong>{formatInr(current.expenseMinor)}</strong></div>
            <div><span>Net</span><strong>{formatInr(current.netMinor)}</strong></div>
          </div>
        </Card>
      </div>

      <div className="money-section-heading">
        <div><h2>Recent transactions</h2><p>Newest ledger entries.</p></div>
        <Link className="money-primary-link" to="/money/transactions">
          Add Transaction
        </Link>
      </div>

      <Card>
        {recent.length ? (
          <div className="money-transaction-list">
            {recent.map((transaction) => (
              <div className="money-transaction-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description || categoryById.get(transaction.categoryId)?.name}</strong>
                  <span>{transaction.date} · {categoryById.get(transaction.categoryId)?.name}</span>
                </div>
                <strong className={`money-amount is-${transaction.type}`}>
                  {transaction.type === "expense" ? "−" : "+"}
                  {formatInr(transaction.amountMinor)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No transactions yet" description="Add income or an expense to begin your ledger." />
        )}
      </Card>

      <div className="money-dashboard-grid">
        <Card>
          <div className="section-header"><h2>Budget status</h2><p>Current month spending.</p></div>
          {budgets.length ? (
            <div className="money-compact-list">
              {budgets.map((budget) => (
                <div key={budget.id}>
                  <span>{categoryById.get(budget.categoryId)?.name}</span>
                  <strong className={`is-${budget.status}`}>{budget.percent}%</strong>
                </div>
              ))}
            </div>
          ) : <p className="money-muted">No monthly budgets configured.</p>}
          <Link className="money-text-link" to="/money/budgets">Manage budgets</Link>
        </Card>

        <Card>
          <div className="section-header"><h2>Savings goals</h2><p>Manually allocated progress.</p></div>
          {goals.length ? (
            <div className="money-compact-list">
              {goals.slice(0, 4).map((goal) => (
                <div key={goal.id}>
                  <span>{goal.name}</span><strong>{goal.percent}%</strong>
                </div>
              ))}
            </div>
          ) : <p className="money-muted">No savings goals yet.</p>}
          <Link className="money-text-link" to="/money/goals">Manage goals</Link>
        </Card>
      </div>

      <div className="money-dashboard-grid">
        <Card>
          <div className="section-header"><h2>Monthly ledger</h2><p>Income, spending, and net.</p></div>
          {months.length ? (
            <div className="money-month-list">
              {months.map((item) => (
                <div key={item.month}>
                  <strong>{item.month}</strong>
                  <span>Income {formatInr(item.incomeMinor)}</span>
                  <span>Spent {formatInr(item.expenseMinor)}</span>
                  <span>Net {formatInr(item.netMinor)}</span>
                </div>
              ))}
            </div>
          ) : <p className="money-muted">Monthly analytics appear after your first transaction.</p>}
        </Card>

        <Card>
          <div className="section-header"><h2>Spending by category</h2><p>Current month.</p></div>
          {categories.length ? (
            <div className="money-compact-list">
              {categories.map((item) => (
                <div key={item.categoryId}>
                  <span>{categoryById.get(item.categoryId)?.name}</span>
                  <strong>{formatInr(item.amountMinor)}</strong>
                </div>
              ))}
            </div>
          ) : <p className="money-muted">No spending recorded this month.</p>}
        </Card>
      </div>
    </div>
  );
}
