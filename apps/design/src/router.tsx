import { personaById, personas } from "@/fixtures/personas.js";
import { ApiKeys } from "@/screens/api-keys.js";
import { Billing } from "@/screens/billing.js";
import { Contacts } from "@/screens/contacts.js";
import { Dashboard } from "@/screens/dashboard.js";
import { Members } from "@/screens/members.js";
import { SignIn } from "@/screens/sign-in.js";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { AppShell } from "@vantion/ui/app/app-shell";
import { Sidebar } from "@vantion/ui/app/sidebar";
import { CreditCard, KeyRound, LayoutDashboard, LogIn, Users, UserSquare } from "lucide-react";

/**
 * The persona travels in the query string.
 *
 * So that a designer can send a link to exactly the state they are talking
 * about — "the members table with nine people and a forty-character domain" —
 * rather than describing it and hoping.
 */
type Search = { readonly persona: string; };

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/members", label: "Members", icon: UserSquare },
  { to: "/api-keys", label: "API keys", icon: KeyRound },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/sign-in", label: "Sign in", icon: LogIn },
];

const PersonaPicker = () => {
  const { persona } = useSearch({ strict: false });
  const navigate = useNavigate();
  const current = persona ?? "settled";

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">
      <span className="text-muted-foreground text-xs">Persona</span>
      <div className="flex gap-1">
        {personas.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.describes}
            onClick={() => void navigate({ to: ".", search: { persona: option.id } })}
            className={option.id === current
              ? "rounded-md bg-accent px-2 py-1 text-xs text-foreground"
              : "rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"}
          >
            {option.name}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground ml-auto text-xs">
        {personaById(current).describes}
      </p>
    </div>
  );
};

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): Search => ({
    persona: typeof search["persona"] === "string" ? search["persona"] : "settled",
  }),
  component: () => {
    const { persona } = useSearch({ from: "__root__" });
    const active = personaById(persona);

    return (
      <div className="flex min-h-screen flex-col">
        <PersonaPicker />
        <AppShell
          sidebar={
            <Sidebar
              workspace={active.workspace}
              email={active.email}
              items={nav}
              onSignOut={() => {}}
            />
          }
        >
          <Outlet />
        </AppShell>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="p-8">
      <p className="text-sm">No such screen.</p>
      <Link
        to="/"
        search={{ persona: "settled" }}
        className="text-muted-foreground text-sm underline"
      >
        Back to the dashboard
      </Link>
    </div>
  ),
});

const screen = (path: string, component: () => React.ReactElement) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  screen("/", Dashboard),
  screen("/contacts", Contacts),
  screen("/members", Members),
  screen("/api-keys", ApiKeys),
  screen("/billing", Billing),
  screen("/sign-in", SignIn),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
