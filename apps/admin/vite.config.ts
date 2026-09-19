import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import * as path from "node:path";
import { defineConfig } from "vite";

/**
 * The admin panel, served from its own process.
 *
 * Its server is where `ADMIN_DATABASE_URL` lives, and the reason this is a
 * separate deployable rather than a route inside `apps/web`: a separate origin
 * can be put behind a VPN, an IP allowlist, or simply not on the public
 * internet, and a route cannot be any of those. It also means a cross-site
 * scripting hole in the customer product cannot reach this surface.
 *
 * Unlike `apps/web` it talks to no other service. The procedures run in this
 * process, through server functions, because the only client is the page this
 * process just rendered — a wire format between them would be a contract with
 * itself.
 */
export default defineConfig(({ command }) => {
  const port = Number(process.env["ADMIN_PORT"] ?? 5174);

  if (command === "serve") process.env["PORT"] = String(port);

  return {
    plugins: [tanstackStart(), nitro(), tailwindcss(), react()],
    ssr: command === "build" ? { noExternal: true } : {},
    resolve: {
      conditions: ["development"],
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: { port, strictPort: true },
  };
});
