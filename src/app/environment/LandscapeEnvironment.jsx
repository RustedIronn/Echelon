import EnvironmentBoundary from "./EnvironmentBoundary.js";
import { ThreeLandscapeWorld } from "./ThreeLandscapeWorld.jsx";

// The current pass intentionally renders one art-directed afternoon world.
// Time, wind, and celestial modules remain separate so later passes can drive
// this scene's material and lighting parameters without replacing geometry.
export default function LandscapeEnvironment() {
  return (
    <div className="landscape-environment" aria-hidden="true">
      <EnvironmentBoundary>
        <ThreeLandscapeWorld className="landscape-environment__three" />
      </EnvironmentBoundary>
      <div className="landscape-environment__fallback" />
    </div>
  );
}
