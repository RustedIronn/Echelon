import { createElement } from "react";
import { createRoot } from "react-dom/client";
import LandscapePreview from "./landscapePreview.jsx";

const root = document.querySelector("#landscape-preview");
if (root) createRoot(root).render(createElement(LandscapePreview));
