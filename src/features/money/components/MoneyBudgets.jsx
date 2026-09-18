import { useState } from "react";

import { Button, Card, EmptyState, ErrorState } from "@ui";
import { getToday } from "../../../shared/date.js";
import { calculateBudgetUsage } from "../budgets.js";
import { useMoney } from "../store.js";
import { formatInr } from "../transactions.js";

export default function MoneyBudgets() {
  const { data, setBudget, deleteBudget } = useMoney();
  const expenseCategories = data.categories.filter(
    (category) => category.type === "expense",
  );
  const [month, setMonth] = useState(getToday().slice(0, 7));
  const [draft, setDraft] = useState({
    categoryId: expenseCategories[0]?.id ?? "",
    amount: "",
  });
  const [formError, setFormError] = useState("");
  const categoryById = new Map(
    data.categories.map((category) => [category.id, category]),
  );
  const usage = data.budgets.map((budget) =>
    calculateBudgetUsage(budget, data.transactions, month),
  );

  return (
    <div className="stack">
      <Card>
        <div className="section-header">
          <h2>Monthly category budgets</h2>
          <p>Spent and remaining values come directly from expense transactions.</p>
        </div>
        <form
          className="money-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (setBudget(draft.categoryId, draft.amount)) {
              setDraft({ ...draft, amount: "" });
              setFormError("");
            } else {
              setFormError("Enter a positive monthly limit.");
            }
          }}
        >
          <label>
            <span>Category</span>
            <select
              value={draft.categoryId}
              onChange={(event) =>
                setDraft({ ...draft, categoryId: event.target.value })
              }
            >
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Monthly limit (₹)</span>
            <input
              required
              inputMode="decimal"
              placeholder="1500"
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </label>
          <Button type="submit">Set Budget</Button>
          {formError ? <ErrorState compact description={formError} /> : null}
        </form>
      </Card>

      <div className="money-section-heading">
        <div><h2>Budget status</h2><p>Normal below 80%, warning from 80–100%, over above 100%.</p></div>
        <label><span>Month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value || getToday().slice(0, 7))} /></label>
      </div>

      {usage.length ? (
        <div className="money-budget-grid">
          {usage.map((budget) => (
            <Card className={`money-budget-card is-${budget.status}`} key={budget.id}>
              <div className="money-section-heading">
                <div><h3>{categoryById.get(budget.categoryId)?.name}</h3><p>{budget.percent}% used</p></div>
                <Button variant="danger" onClick={() => deleteBudget(budget.id)}>Remove</Button>
              </div>
              <div className="money-progress" aria-label={`${budget.percent}% of budget used`}>
                <i style={{ width: `${budget.visualPercent}%` }} />
              </div>
              <div className="money-summary-list">
                <div><span>Spent</span><strong>{formatInr(budget.spentMinor)}</strong></div>
                <div><span>Limit</span><strong>{formatInr(budget.monthlyLimitMinor)}</strong></div>
                <div><span>{budget.remainingMinor < 0 ? "Over by" : "Remaining"}</span><strong>{formatInr(Math.abs(budget.remainingMinor))}</strong></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState title="No budgets yet" description="Set a monthly expense-category limit above." /></Card>
      )}
    </div>
  );
}
