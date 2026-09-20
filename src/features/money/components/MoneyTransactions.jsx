import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button, Card, EmptyState, ErrorState, PanelHeader } from "@ui";
import { formatDayKey, getToday } from "../../../shared/date.js";
import { useMoney } from "../store.js";
import { createMoneyId, filterTransactions, formatInr, minorToInput } from "../transactions.js";

const newDraft = (categories, type = "expense") => ({
  type, amount: "", categoryId: categories.find((category) => category.type === type)?.id ?? "",
  description: "", date: getToday(), recurring: false,
});

export default function MoneyTransactions() {
  const { data, addTransaction, editTransaction, deleteTransaction } = useMoney();
  const [draft, setDraft] = useState(() => newDraft(data.categories));
  const [draftId, setDraftId] = useState(() => createMoneyId("transaction"));
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [filters, setFilters] = useState({ month: getToday().slice(0, 7), type: "all", categoryId: "all" });
  const [formError, setFormError] = useState("");
  const submitting = useRef(false);
  const categoriesForType = data.categories.filter((category) => category.type === draft.type);
  const visible = filterTransactions(data.transactions, filters);
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));

  const closeForm = () => {
    setFormOpen(false); setDraft(newDraft(data.categories)); setDraftId(createMoneyId("transaction"));
    setEditingId(null); setFormError("");
  };

  useEffect(() => {
    if (!formOpen) return undefined;
    const dismiss = (event) => { if (event.key === "Escape") closeForm(); };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [formOpen, data.categories]);

  const submit = (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const success = editingId ? editTransaction(editingId, draft) : addTransaction(draft, { id: draftId });
    submitting.current = false;
    if (success) closeForm();
    else setFormError("Enter a positive amount and a matching category and date.");
  };

  const beginAdd = () => {
    setEditingId(null); setDraft(newDraft(data.categories)); setDraftId(createMoneyId("transaction"));
    setFormError(""); setFormOpen(true);
  };

  const beginEdit = (transaction) => {
    setEditingId(transaction.id);
    setDraft({ type: transaction.type, amount: minorToInput(transaction.amountMinor), categoryId: transaction.categoryId, description: transaction.description, date: transaction.date, recurring: transaction.recurring });
    setFormError(""); setFormOpen(true);
  };

  return (
    <div className="money-ledger-page">
      <Card className="money-ledger-card">
        <PanelHeader eyebrow="Ledger" title="Transactions" description="Newest first. Filters stay close to the records they affect." actions={<Button onClick={beginAdd}><Plus size={16} aria-hidden="true" /> Add transaction</Button>} />
        <div className="money-filter-grid is-compact">
          <label><span>Month</span><input type="month" value={filters.month === "all" ? "" : filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value || "all" })} /></label>
          <label><span>Type</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option></select></label>
          <label><span>Category</span><select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}><option value="all">All categories</option>{data.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <Button variant="secondary" onClick={() => setFilters({ ...filters, month: "all" })}>All months</Button>
        </div>
        {visible.length ? <div className="money-transaction-list">{visible.map((transaction) => <div className="money-transaction-row" key={transaction.id}>
          <div><strong>{transaction.description || categoryById.get(transaction.categoryId)?.name}</strong><span>{formatDayKey(transaction.date)} · {categoryById.get(transaction.categoryId)?.name}{transaction.recurring ? " · Recurring" : ""}</span></div>
          <strong className={`money-amount is-${transaction.type}`}>{transaction.type === "expense" ? "−" : "+"}{formatInr(transaction.amountMinor)}</strong>
          <div className="money-row-actions"><Button variant="secondary" onClick={() => beginEdit(transaction)}>Edit</Button>{pendingDeleteId === transaction.id ? <><Button variant="danger" onClick={() => { deleteTransaction(transaction.id); setPendingDeleteId(null); if (editingId === transaction.id) closeForm(); }}>Confirm delete</Button><Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancel</Button></> : <Button variant="secondary" onClick={() => setPendingDeleteId(transaction.id)}>Delete</Button>}</div>
        </div>)}</div> : <EmptyState compact title="No matching transactions" description="Adjust the filters or add a transaction." />}
      </Card>

      {formOpen ? <div className="money-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
        <aside className="money-transaction-drawer" role="dialog" aria-modal="true" aria-labelledby="money-transaction-form-title">
          <div className="money-drawer-heading"><div><span>Ledger entry</span><h2 id="money-transaction-form-title">{editingId ? "Edit transaction" : "Add transaction"}</h2></div><button type="button" onClick={closeForm} aria-label="Close transaction form"><X size={20} /></button></div>
          <form className="money-form" onSubmit={submit}>
            <label><span>Type</span><select value={draft.type} onChange={(event) => { const type = event.target.value; setDraft({ ...draft, type, categoryId: data.categories.find((item) => item.type === type)?.id ?? "" }); }}><option value="expense">Expense</option><option value="income">Income</option></select></label>
            <label><span>Amount (₹)</span><input autoFocus required inputMode="decimal" placeholder="337.50" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
            <label><span>Category</span><select required value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{categoriesForType.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label><span>Date</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label className="money-form-wide"><span>Description (optional)</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="money-check"><input type="checkbox" checked={draft.recurring} onChange={(event) => setDraft({ ...draft, recurring: event.target.checked })} /><span>Recurring metadata</span></label>
            <div className="money-form-actions"><Button type="submit">{editingId ? "Save changes" : "Add transaction"}</Button><Button variant="secondary" onClick={closeForm}>Cancel</Button></div>
            {formError ? <ErrorState compact description={formError} /> : null}
          </form>
        </aside>
      </div> : null}
    </div>
  );
}
