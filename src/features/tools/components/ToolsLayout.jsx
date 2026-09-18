import { Outlet } from "react-router-dom";

import { PageTitle, Subnav } from "@ui";
import { useTools } from "../store.js";

const sections = [
  { label: "Overview", path: "/tools", end: true },
  { label: "Now", path: "/tools/now" },
  { label: "Brain Dump", path: "/tools/brain-dump" },
  { label: "Breakdown", path: "/tools/breakdown" },
  { label: "Timer", path: "/tools/timer" },
  { label: "Reset", path: "/tools/reset" },
];

export default function ToolsLayout() {
  const owner = useTools((state) => state.owner);

  return (
    <div className="page tools-app">
      <PageTitle
        label="TOOLBOX"
        title="What matters right now?"
        description="A few quiet tools for finding the next workable step."
      />

      <Subnav label="Toolbox sections" items={sections} />

      <Outlet key={owner ?? "anonymous"} />
    </div>
  );
}
