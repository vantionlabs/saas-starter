import { ContactStore } from "@vantion/module-contact/ContactStore";
import { listFiles } from "@vantion/module-files/FileStore";
import { CurrentEntitlement } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import type { Forbidden } from "@vantion/module-iam/identity/Policy";
import { permission, withPolicy } from "@vantion/module-iam/identity/Policy";
import { Effect } from "effect";
import { AgentToolkit, Caller, ContactSummary, FileSummary, ToolRefused } from "./Tools.js";

/**
 * A policy refusal becomes a value the model can read.
 *
 * `Forbidden` carries the permission that was missing, and that is worth
 * passing through rather than flattening to "no": a model told it lacks
 * `contact:create` can say so to the person, who can then ask an admin. A model
 * told "error" invents a reason.
 */
const refusable = <A, R>(effect: Effect.Effect<A, Forbidden, R>) =>
  effect.pipe(
    Effect.catchTag("Forbidden", (forbidden) => new ToolRefused({ required: forbidden.required })),
  );

const summarise = (contact: { id: string; email: string; fullName: string; }) =>
  new ContactSummary({ id: contact.id, email: contact.email, fullName: contact.fullName });

/**
 * The handlers, over the same stores every other transport uses.
 *
 * Each one runs through the same `Policy` as the equivalent RPC, against the
 * *calling* identity — so a tool is structurally incapable of doing what the
 * person driving it may not. There is no separate scope vocabulary to keep in
 * step with `Permission.ts`, because there is no separate vocabulary at all.
 */
export const AgentToolkitLive = AgentToolkit.toLayer(
  Effect.gen(function*() {
    const contacts = yield* ContactStore;

    return {
      WhoAmI: () =>
        Effect.gen(function*() {
          const identity = yield* CurrentUser;
          const entitlement = yield* CurrentEntitlement;

          return new Caller({
            email: identity.email,
            organizationId: identity.orgId,
            role: identity.role,
            plan: entitlement.effectivePlan,
            permissions: identity.permissions,
          });
        }),

      ListContacts: () => refusable(Effect.map(contacts.list, (rows) => rows.map(summarise))),

      SearchContacts: ({ query }) =>
        refusable(
          Effect.map(contacts.list, (rows) => {
            const needle = query.toLowerCase();

            // Filtered here rather than in SQL on purpose: `list` is the
            // policy-checked, org-scoped read, and a second query would be a
            // second place for those two to be got right.
            return rows
              .filter((row) =>
                row.email.toLowerCase().includes(needle)
                || row.fullName.toLowerCase().includes(needle)
              )
              .map(summarise);
          }),
        ),

      CreateContact: (input) => refusable(Effect.map(contacts.create(input), summarise)),

      ListFiles: () =>
        refusable(
          listFiles.pipe(
            withPolicy(permission("file:read")),
            Effect.map((files) =>
              files.map((file) =>
                new FileSummary({
                  id: file.id,
                  name: file.name,
                  contentType: file.contentType,
                  size: file.size,
                })
              )
            ),
          ),
        ),
    };
  }),
);
