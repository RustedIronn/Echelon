import { NavLink, Outlet } from "react-router-dom";

import { PageTitle } from "@ui";
import { useTools } from "../store.js";

const sections = [
  ["Overview", "/tools"],
  ["Now", "/tools/now"],
  ["Brain Dump", "/tools/brain-dump"],
  ["Breakdown", "/tools/breakdown"],
  ["Timer", "/tools/timer"],
  ["Reset", "/tools/reset"],
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

      <nav className="tools-subnav" aria-label="Toolbox sections">
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
