import { Link } from "react-router-dom";

import { ActionLink, Card, EmptyState, Mosaic, PanelHeader, SectionLead } from "@ui";
import { formatDayKey, formatMonthKey, getToday } from "../../../shared/date.js";
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
      <Mosaic layout="split" className="money-overview-grid">
        <Card material="feature" className="money-balance-card">
          <span>Available</span>
          <strong>{formatInr(allTime.netMinor)}</strong>
          <small>Income minus expenses across the full ledger.</small>
        </Card>

        <Card material="soft" shape="slab">
          <div className="section-header">
            <h2>This month</h2>
            <p>{formatMonthKey(month)}</p>
          </div>
          <div className="money-summary-list">
            <div><span>Income</span><strong>{formatInr(current.incomeMinor)}</strong></div>
            <div><span>Spent</span><strong>{formatInr(current.expenseMinor)}</strong></div>
            <div><span>Net</span><strong>{formatInr(current.netMinor)}</strong></div>
          </div>
        </Card>
      </Mosaic>

      <SectionLead eyebrow="Ledger" title="Recent transactions" description="Newest entries, without losing the bigger picture.">
        <Link className="money-primary-link" to="/money/transactions?add=1">
          Add Transaction
        </Link>
      </SectionLead>

      <Card shape="slab">
        {recent.length ? (
          <div className="money-transaction-list">
            {recent.map((transaction) => (
              <div className="money-transaction-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description || categoryById.get(transaction.categoryId)?.name}</strong>
                  <span>{formatDayKey(transaction.date)} · {categoryById.get(transaction.categoryId)?.name}</span>
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

      <Card material="soft" className="money-health-panel">
        <PanelHeader eyebrow="Guardrails" title="Budgets and goals" description="Current-month limits beside manually allocated savings." />
        <div className="money-health-grid">
          <section>
            <h3>Budget status</h3>
          {budgets.length ? (
            <div className="money-compact-list">
              {budgets.map((budget) => (
                <div key={budget.id}>
                  <span>{budget.categoryId === null ? "Overall spending" : categoryById.get(budget.categoryId)?.name}</span>
                  <strong className={`is-${budget.status}`}>{budget.percent}%</strong>
                </div>
              ))}
            </div>
          ) : <p className="money-muted">No monthly budgets configured.</p>}
          <ActionLink direction="forward" to="/money/budgets">Budgets</ActionLink>
          </section>

          <section>
            <h3>Savings goals</h3>
          {goals.length ? (
            <div className="money-compact-list">
              {goals.slice(0, 4).map((goal) => (
                <div key={goal.id}>
                  <span>{goal.name}</span><strong>{goal.percent}%</strong>
                </div>
              ))}
            </div>
          ) : <p className="money-muted">No savings goals yet.</p>}
          <ActionLink direction="forward" to="/money/goals">Goals</ActionLink>
          </section>
        </div>
      </Card>

      <Mosaic layout="split" className="money-dashboard-grid">
        <Card>
          <div className="section-header"><h2>Monthly ledger</h2><p>Income, spending, and net.</p></div>
          {months.length ? (
            <div className="money-month-list">
              {months.map((item) => (
                <div key={item.month}>
                  <strong>{formatMonthKey(item.month)}</strong>
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
      </Mosaic>
    </div>
  );
}
