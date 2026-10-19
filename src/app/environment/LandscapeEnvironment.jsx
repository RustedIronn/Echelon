import { useEffect, useRef } from "react";
import { LANDSCAPE_VIEW, renderLandscape } from "./landscapeScene.js";
import { useEnvironmentLighting } from "./environmentTime.js";

export default function LandscapeEnvironment() {
  const canvasRef = useRef(null);
  const lighting = useEnvironmentLighting();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return undefined;

    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.max(bounds.width / LANDSCAPE_VIEW.width, bounds.height / LANDSCAPE_VIEW.height);
      // Narrow screens retain the same fixed world but frame its watercourse as
      // the visual anchor instead of cropping it against the right edge.
      const cameraFocusX = bounds.width <= 760 ? 850 : LANDSCAPE_VIEW.width / 2;
      const offsetX = (bounds.width / 2) - (cameraFocusX * scale);
      const offsetY = (bounds.height - (LANDSCAPE_VIEW.height * scale)) / 2;

      canvas.width = Math.round(bounds.width * density);
      canvas.height = Math.round(bounds.height * density);
      context.setTransform(density * scale, 0, 0, density * scale, density * offsetX, density * offsetY);
      renderLandscape(context, lighting);
    };

    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();

    return () => observer.disconnect();
  }, [lighting]);

  return (
    <div className="landscape-environment" aria-hidden="true">
      <canvas className="landscape-environment__canvas" ref={canvasRef} />
      <div className="landscape-environment__fallback" />
    </div>
  );
}
