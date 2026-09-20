import { Outlet } from "react-router-dom";

import { PageTitle, Stage, Subnav } from "@ui";
import { useMoney } from "../store.js";

const sections = [
  { label: "Overview", path: "/money", end: true },
  { label: "Transactions", path: "/money/transactions" },
  { label: "Budgets", path: "/money/budgets" },
  { label: "Goals", path: "/money/goals" },
];

export default function MoneyLayout() {
  const owner = useMoney((state) => state.owner);

  return (
    <div className="page money-app">
      <PageTitle
        tone="ledger"
        label="MONEY"
        title="Money"
        description="A clear, manual ledger for your financial life."
      />

      <Subnav label="Money sections" items={sections} />

      <Stage tone="ledger" className="money-stage">
        <Outlet key={owner ?? "anonymous"} />
      </Stage>
    </div>
  );
}
