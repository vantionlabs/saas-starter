import { personaById, personas } from "@/fixtures/personas.js";
import { AdminPerson } from "@/screens/admin-person.js";
import { Admin } from "@/screens/admin.js";
import { ApiKeys } from "@/screens/api-keys.js";
import { Assistant } from "@/screens/assistant.js";
import { Billing } from "@/screens/billing.js";
import { Brand } from "@/screens/brand.js";
import { Contacts } from "@/screens/contacts.js";
import { Dashboard } from "@/screens/dashboard.js";
import { Marketing } from "@/screens/marketing.js";
import { Members } from "@/screens/members.js";
import { Onboarding } from "@/screens/onboarding.js";
import { SignIn } from "@/screens/sign-in.js";
import { Sso } from "@/screens/sso.js";
import { Webhooks } from "@/screens/webhooks.js";
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
import {
  CreditCard,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LogIn,
  Megaphone,
  Palette,
  Rocket,
  ShieldAlert,
  Sparkles,
  Users,
  UserSearch,
  UserSquare,
  Webhook,
} from "lucide-react";

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
  { to: "/assistant", label: "Assistant", icon: Sparkles },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/members", label: "Members", icon: UserSquare },
  { to: "/api-keys", label: "API keys", icon: KeyRound },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/sso", label: "Single sign-on", icon: Fingerprint },
  { to: "/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/sign-in", label: "Sign in", icon: LogIn },
  { to: "/onboarding", label: "Onboarding", icon: Rocket },
  /**
   * The other two surfaces, on the same canvas.
   *
   * They have no personas — a landing page has no empty state — but they are
   * here so a designer works on one app and `/figma-screen` reads one source.
   */
  { to: "/marketing", label: "Marketing", icon: Megaphone },
  { to: "/brand", label: "Brand", icon: Palette },
  { to: "/admin", label: "Staff trail", icon: ShieldAlert },
  { to: "/admin-person", label: "Find a person", icon: UserSearch },
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

/**
 * Exported so a test can build a router of its own with in-memory history.
 *
 * The singleton below is what the app runs; sharing it between tests would
 * share its navigation state too, and a screen would be rendered at whatever
 * path the previous test left behind.
 */
export const routeTree = rootRoute.addChildren([
  screen("/", Dashboard),
  screen("/assistant", Assistant),
  screen("/contacts", Contacts),
  screen("/members", Members),
  screen("/api-keys", ApiKeys),
  screen("/billing", Billing),
  screen("/sso", Sso),
  screen("/webhooks", Webhooks),
  screen("/sign-in", SignIn),
  screen("/onboarding", Onboarding),
  screen("/marketing", Marketing),
  screen("/brand", Brand),
  screen("/admin", Admin),
  screen("/admin-person", AdminPerson),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
