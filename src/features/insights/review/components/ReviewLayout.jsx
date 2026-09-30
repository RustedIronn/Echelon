import { Outlet } from "react-router-dom";

import { PageTitle, Subnav } from "@ui";
import { useComposure } from "../js/composureStore.js";

const sections = [
  { label: "Daily", path: "/review", end: true },
  { label: "Composure", path: "/review/composure" },
];

export default function ReviewLayout() {
  const owner = useComposure((state) => state.owner);

  return (
    <div className="page review-app">
      <PageTitle
        label="REFLECTION"
        title="Review"
        description="Learn from the day without turning it into a judgment."
      />

      <Subnav
        label="Review sections"
        items={sections}
      />

      <Outlet key={owner ?? "anonymous"} />
    </div>
  );
}
