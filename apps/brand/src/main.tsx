import "@/app.css";
import { Brand } from "@/brand.js";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";

/** The markup is already there — `pnpm build` wrote it. See `prerender.mjs`. */
const root = document.getElementById("root") as HTMLElement;

hydrateRoot(
  root,
  <React.StrictMode>
    <Brand />
  </React.StrictMode>,
);
