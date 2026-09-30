import { useState } from "react";

import { Button, Card, EmptyState, ErrorState } from "@ui";
import { DEFAULT_CATEGORY_IDS } from "../js/constants.js";
import { getCategoryDeletionState } from "../js/categories.js";
import { useMoney } from "../js/store.js";

export default function MoneyCategorySettings() {
  const { data, addCategory, deleteCategory } = useMoney();
  const [draft, setDraft] = useState({ name: "", type: "expense" });
  const [error, setError] = useState("");
  const custom = data.categories.filter((category) => !DEFAULT_CATEGORY_IDS.has(category.id));

  const submit = (event) => {
    event.preventDefault();
    if (addCategory(draft)) {
      setDraft({ ...draft, name: "" });
      setError("");
    } else setError("Use a unique category name.");
  };

  return (
    <Card>
      <div className="section-header"><h2>Money categories</h2><p>Custom ledger categories live here instead of beside daily transactions.</p></div>
      <form className="money-inline-form" onSubmit={submit}>
        <label><span>Name</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label><span>Type</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select></label>
        <Button type="submit">Add category</Button>
        {error ? <ErrorState compact description={error} /> : null}
      </form>
      {custom.length ? <div className="money-category-list">{custom.map((category) => {
        const deletion = getCategoryDeletionState(category.id, data.transactions, data.budgets);
        return <div key={category.id}><span>{category.name} · {category.type}</span><Button variant="danger" disabled={!deletion.allowed} title={deletion.reason} onClick={() => deleteCategory(category.id)}>Delete</Button>{!deletion.allowed ? <small>{deletion.reason}</small> : null}</div>;
      })}</div> : <EmptyState compact title="No custom categories" description="Defaults cover the ledger until you need another." />}
    </Card>
  );
}
