import { Outlet } from "react-router-dom";

import { PageTitle, Stage, Subnav } from "@ui";
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
        tone="play"
        label="WORKBENCH"
        title="Tools"
        description="Find the next workable step, clear noise, or make time visible."
      />

      <Subnav label="Toolbox sections" items={sections} />

      <Stage tone="play" className="tools-stage">
        <Outlet key={owner ?? "anonymous"} />
      </Stage>
    </div>
  );
}
