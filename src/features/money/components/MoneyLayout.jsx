import { NavLink, Outlet } from "react-router-dom";

import { PageTitle } from "@ui";
import { useMoney } from "../store.js";

const sections = [
  ["Overview", "/money"],
  ["Transactions", "/money/transactions"],
  ["Budgets", "/money/budgets"],
  ["Goals", "/money/goals"],
];

export default function MoneyLayout() {
  const owner = useMoney((state) => state.owner);

  return (
    <div className="page money-app">
      <PageTitle
        label="MONEY"
        title="Money"
        description="A clear, manual ledger for your financial life."
      />

      <nav className="money-subnav" aria-label="Money sections">
        {sections.map(([label, path], index) => (
          <NavLink key={path} to={path} end={index === 0}>
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet key={owner ?? "anonymous"} />
    </div>
  );
}
