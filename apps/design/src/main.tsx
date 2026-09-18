import "@/app.css";
import { router } from "@/router.js";
import { RouterProvider } from "@tanstack/react-router";
import * as React from "react";
import { createRoot } from "react-dom/client";

/**
 * `index.html` in this package declares `#root`, so this cannot be missing
 * except by editing that file — which is why the mount asserts rather than
 * modelling a failure nobody can act on.
 */
const root = document.getElementById("root") as HTMLElement;

createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
