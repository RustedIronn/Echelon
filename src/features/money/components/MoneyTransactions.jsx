import { useRef, useState } from "react";

import { Button, Card, EmptyState, ErrorState } from "@ui";
import { formatDayKey, getToday } from "../../../shared/date.js";
import { DEFAULT_CATEGORY_IDS } from "../constants.js";
import { getCategoryDeletionState } from "../categories.js";
import { useMoney } from "../store.js";
import {
  createMoneyId,
  filterTransactions,
  formatInr,
  minorToInput,
} from "../transactions.js";

const newDraft = (categories, type = "expense") => ({
  type,
  amount: "",
  categoryId: categories.find((category) => category.type === type)?.id ?? "",
  description: "",
  date: getToday(),
  recurring: false,
});

export default function MoneyTransactions() {
  const { data, addTransaction, editTransaction, deleteTransaction, addCategory, deleteCategory } = useMoney();
  const [draft, setDraft] = useState(() => newDraft(data.categories));
  const [draftId, setDraftId] = useState(() => createMoneyId("transaction"));
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [filters, setFilters] = useState({ month: getToday().slice(0, 7), type: "all", categoryId: "all" });
  const [categoryDraft, setCategoryDraft] = useState({ name: "", type: "expense" });
  const [formError, setFormError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const submitting = useRef(false);
  const categoriesForType = data.categories.filter((category) => category.type === draft.type);
  const visible = filterTransactions(data.transactions, filters);
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));

  const resetForm = () => {
    setDraft(newDraft(data.categories));
    setDraftId(createMoneyId("transaction"));
    setEditingId(null);
    setFormError("");
  };

  const submit = (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const success = editingId
      ? editTransaction(editingId, draft)
      : addTransaction(draft, { id: draftId });
    submitting.current = false;
    if (success) resetForm();
    else setFormError("Enter a positive amount and a matching category and date.");
  };

  const beginEdit = (transaction) => {
    setEditingId(transaction.id);
    setDraft({
      type: transaction.type,
      amount: minorToInput(transaction.amountMinor),
      categoryId: transaction.categoryId,
      description: transaction.description,
      date: transaction.date,
      recurring: transaction.recurring,
    });
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const removeCategory = (categoryId) => {
    if (!deleteCategory(categoryId)) return;

    if (draft.categoryId === categoryId) {
      setDraft({
        ...draft,
        categoryId:
          data.categories.find(
            (category) =>
              category.type === draft.type && category.id !== categoryId,
          )?.id ?? "",
      });
    }
    if (filters.categoryId === categoryId) {
      setFilters({ ...filters, categoryId: "all" });
    }
  };

  return (
    <div className="stack">
      <Card>
        <div className="section-header"><h2>{editingId ? "Edit transaction" : "Add transaction"}</h2><p>Amounts are stored exactly in paise.</p></div>
        <form className="money-form" onSubmit={submit}>
          <label><span>Type</span><select value={draft.type} onChange={(event) => { const type = event.target.value; setDraft({ ...draft, type, categoryId: data.categories.find((item) => item.type === type)?.id ?? "" }); }}><option value="expense">Expense</option><option value="income">Income</option></select></label>
          <label><span>Amount (₹)</span><input required inputMode="decimal" placeholder="337.50" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
          <label><span>Category</span><select required value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{categoriesForType.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label><span>Date</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          <label className="money-form-wide"><span>Description (optional)</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="money-check"><input type="checkbox" checked={draft.recurring} onChange={(event) => setDraft({ ...draft, recurring: event.target.checked })} /><span>Recurring metadata</span></label>
          <div className="money-form-actions"><Button type="submit">{editingId ? "Save Changes" : "Add Transaction"}</Button>{editingId ? <Button variant="secondary" onClick={resetForm}>Cancel</Button> : null}</div>
          {formError ? <ErrorState compact description={formError} /> : null}
        </form>
      </Card>

      <Card>
        <div className="section-header"><h2>Transaction history</h2><p>Newest first, with deterministic same-day ordering.</p></div>
        <div className="money-filter-grid">
          <label><span>Month</span><input type="month" value={filters.month === "all" ? "" : filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value || "all" })} /></label>
          <label><span>Type</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select></label>
          <label><span>Category</span><select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}><option value="all">All categories</option>{data.categories.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.type}</option>)}</select></label>
          <Button variant="secondary" onClick={() => setFilters({ ...filters, month: "all" })}>All months</Button>
        </div>

        {visible.length ? <div className="money-transaction-list">{visible.map((transaction) => <div className="money-transaction-row" key={transaction.id}><div><strong>{transaction.description || categoryById.get(transaction.categoryId)?.name}</strong><span>{formatDayKey(transaction.date)} · {categoryById.get(transaction.categoryId)?.name}{transaction.recurring ? " · Recurring" : ""}</span></div><strong className={`money-amount is-${transaction.type}`}>{transaction.type === "expense" ? "−" : "+"}{formatInr(transaction.amountMinor)}</strong><div className="money-row-actions"><Button variant="secondary" onClick={() => beginEdit(transaction)}>Edit</Button>{pendingDeleteId === transaction.id ? <><Button variant="danger" onClick={() => { const deleted = deleteTransaction(transaction.id); setPendingDeleteId(null); if (deleted && editingId === transaction.id) resetForm(); }}>Confirm delete</Button><Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</Button></> : <Button variant="secondary" onClick={() => setPendingDeleteId(transaction.id)}>Delete</Button>}</div></div>)}</div> : <EmptyState title="No matching transactions" description="Adjust the filters or add a transaction." />}
      </Card>

      <Card>
        <div className="section-header"><h2>Custom categories</h2><p>Referenced and default categories cannot be deleted.</p></div>
        <form className="money-inline-form" onSubmit={(event) => { event.preventDefault(); if (addCategory(categoryDraft)) { setCategoryDraft({ ...categoryDraft, name: "" }); setCategoryError(""); } else setCategoryError("Use a unique category name."); }}><label><span>Name</span><input required value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></label><label><span>Type</span><select value={categoryDraft.type} onChange={(event) => setCategoryDraft({ ...categoryDraft, type: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></label><Button type="submit">Add Category</Button>{categoryError ? <ErrorState compact description={categoryError} /> : null}</form>
        <div className="money-category-list">{data.categories.filter((category) => !DEFAULT_CATEGORY_IDS.has(category.id)).map((category) => { const deletion = getCategoryDeletionState(category.id, data.transactions, data.budgets); return <div key={category.id}><span>{category.name} · {category.type}</span><Button variant="danger" disabled={!deletion.allowed} title={deletion.reason} onClick={() => removeCategory(category.id)}>Delete</Button>{!deletion.allowed ? <small>{deletion.reason}</small> : null}</div>; })}</div>
      </Card>
    </div>
  );
}
