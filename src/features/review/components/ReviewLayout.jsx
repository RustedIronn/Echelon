import { NavLink, Outlet } from "react-router-dom";

import { PageTitle } from "@ui";
import { useComposure } from "../composureStore.js";

export default function ReviewLayout() {
  const owner = useComposure((state) => state.owner);

  return (
    <div className="page review-app">
      <PageTitle
        label="REFLECTION"
        title="Review"
        description="Learn from the day without turning it into a judgment."
      />

      <nav className="review-subnav" aria-label="Review sections">
        <NavLink to="/review" end>Daily</NavLink>
        <NavLink to="/review/composure">Composure</NavLink>
      </nav>

      <Outlet key={owner ?? "anonymous"} />
    </div>
  );
}
