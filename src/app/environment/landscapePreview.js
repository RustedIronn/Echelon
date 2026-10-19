import { LANDSCAPE_VIEW, renderLandscape } from "./landscapeScene.js";
import { getDevelopmentPreviewLighting, getEnvironmentLighting } from "./environmentTime.js";

const canvas = document.querySelector("#landscape-preview");
const context = canvas?.getContext("2d", { alpha: false });

function render() {
  if (!canvas || !context) return;

  const density = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.max(width / LANDSCAPE_VIEW.width, height / LANDSCAPE_VIEW.height);
  const cameraFocusX = width <= 760 ? 850 : LANDSCAPE_VIEW.width / 2;
  const offsetX = (width / 2) - (cameraFocusX * scale);
  const offsetY = (height - (LANDSCAPE_VIEW.height * scale)) / 2;

  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  context.setTransform(density * scale, 0, 0, density * scale, density * offsetX, density * offsetY);
  const previewLighting = getDevelopmentPreviewLighting(window.location.search);
  renderLandscape(context, previewLighting ?? getEnvironmentLighting());
}

window.addEventListener("resize", render);
render();
