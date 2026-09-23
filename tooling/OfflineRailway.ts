/**
 * Railway, as far as `alchemy.run.ts` can tell, with no Railway behind it.
 *
 * `alchemy plan` is not offline: before it plans a create, the engine asks each
 * provider whether the resource already exists, so it can adopt rather than
 * duplicate — and for Railway that is an API call with a token. These stand-ins
 * answer "it does not" and record what they were asked to create, so the real
 * engine can plan and apply the real stack against nothing and say what a
 * stage would be made of: every resource, its settings, and the variables it
 * would carry, with references still as the `${{…}}` templates Railway would
 * receive.
 *
 * What this cannot say is whether Railway would accept it — a name already
 * taken, a token without the right scope, a repository the account is not
 * connected to. That is `bun run deploy:plan`, with a token.
 */
import * as Provider from "alchemy/Provider";
import { CustomDomain } from "alchemy/Railway/CustomDomain";
import { Postgres } from "alchemy/Railway/Postgres";
import { Project } from "alchemy/Railway/Project";
import { Providers } from "alchemy/Railway/Providers";
import { Redis } from "alchemy/Railway/Redis";
import { Service } from "alchemy/Railway/Service";
import { Random, RandomProvider } from "alchemy/Random";
import { Effect, Layer } from "effect";

/** One resource the stack asked for, with the settings it asked for it with. */
export interface Planned {
  readonly type: string;
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
}

/**
 * The attributes a real provider would have read back from Railway, invented.
 *
 * Only what the stack reads off a resource matters — `name`, a project's and
 * service's ids, a domain's verification — and the rest is carried across from
 * the props so a later resource that references this one sees what it set.
 */
const attributes = (id: string, props: Readonly<Record<string, unknown>>) => ({
  ...props,
  name: typeof props["name"] === "string" ? props["name"] : id,
  projectId: "offline-project",
  environmentId: "offline-environment",
  serviceId: `offline-${id}`,
  connectionUri: `postgresql://offline@${id}.railway.internal:5432/railway`,
  publicConnectionUri: "",
  verified: false,
  verificationDnsHost: undefined,
  verificationToken: undefined,
});

/**
 * Stand-in providers for the five Railway types the stack uses, and the list
 * they write to. A fresh list per call, so two stages planned in one process
 * do not read each other's resources.
 */
export const offlineRailway = () => {
  const planned: Array<Planned> = [];

  /**
   * One stand-in's lifecycle. Nothing exists yet, so every resource is a
   * create; `reconcile` records it and answers with invented attributes.
   */
  const standIn = (type: string) => ({
    read: () => Effect.succeed(undefined),
    reconcile: ({ id, news }: { readonly id: string; readonly news: unknown; }) =>
      Effect.sync(() => {
        const props = (news ?? {}) as Readonly<Record<string, unknown>>;
        planned.push({ type, id, props });

        return attributes(id, props) as never;
      }),
    delete: () => Effect.void,
  });

  const providers = Layer.effect(
    Providers,
    Provider.collection([Project, Postgres, Redis, Service, CustomDomain, Random]),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        Provider.succeed(Project, standIn("Railway.Project")),
        Provider.succeed(Postgres, standIn("Railway.Postgres")),
        Provider.succeed(Redis, standIn("Railway.Redis")),
        Provider.succeed(Service, standIn("Railway.Service")),
        Provider.succeed(CustomDomain, standIn("Railway.CustomDomain")),
        // The real one: it mints the generated database and Redis passwords
        // with `crypto` and never leaves the process.
        RandomProvider(),
      ),
    ),
  );

  return { providers, planned };
};
