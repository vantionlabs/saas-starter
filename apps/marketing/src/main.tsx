import "@/app.css";
import { Site } from "@/Site.js";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";

/**
 * Hydrated rather than rendered, because the page already exists.
 *
 * `pnpm build` writes the markup into `index.html`, so the content is there
 * before this file loads — and if JavaScript never arrives, the page still
 * reads. Calling `createRoot` here would throw that away by replacing the
 * server's markup with an identical client render.
 */
const root = document.getElementById("root") as HTMLElement;

hydrateRoot(
  root,
  <React.StrictMode>
    <Site />
  </React.StrictMode>,
);
