import { AgentToolkitLive } from "@/ToolkitLive.js";
import { AgentToolkit, ToolRefused } from "@/Tools.js";
import { describe, expect, it } from "@effect/vitest";
import { withOrgScopeFor } from "@vantion/database/OrgScope";
import { PgLive } from "@vantion/database/PgLive";
import { PgPoolTest, testDbUrl } from "@vantion/database/PgTest";
import { ContactStore } from "@vantion/module-contact/ContactStore";
import { CurrentEntitlement, free } from "@vantion/module-iam/identity/Entitlement";
import { CurrentUser, Identity, OrgId, UserId } from "@vantion/module-iam/identity/Identity";
import type { Permission } from "@vantion/module-iam/identity/Permission";
import { permissionsFor } from "@vantion/module-iam/identity/Permission";
import { Effect, Layer, Stream } from "effect";
import type { AiError, Tool } from "effect/unstable/ai";
import { SqlClient } from "effect/unstable/sql";

const identity = (org: string, role: string, permissions?: ReadonlyArray<Permission>) =>
  new Identity({
    userId: UserId.make(`user_${org}`),
    orgId: OrgId.make(org),
    email: `${org}@example.com`,
    emailVerified: true,
    role,
    permissions: permissions ?? Array.from(permissionsFor(role)),
  });

const as = (org: string, role: string, permissions?: ReadonlyArray<Permission>) =>
  AgentToolkitLive.pipe(
    Layer.provideMerge(Layer.succeed(CurrentUser)(identity(org, role, permissions))),
    Layer.provideMerge(Layer.succeed(CurrentEntitlement)(free)),
    Layer.provideMerge(ContactStore.layer),
    Layer.provideMerge(PgLive),
    Layer.provideMerge(PgPoolTest),
  );

type Tools = typeof AgentToolkit["tools"];

/**
 * Runs one tool and returns what it produced, the way a model's loop does.
 *
 * A handler streams, so that a long-running tool can report progress; these all
 * emit once, and the last result is the answer either way.
 */
const call = <Name extends keyof Tools>(
  name: Name,
  params: Tool.Parameters<Tools[Name]> = {} as Tool.Parameters<Tools[Name]>,
) =>
  Effect.gen(function*() {
    const toolkit = yield* AgentToolkit;
    const stream = yield* toolkit.handle(name, params);
    const results = yield* Stream.runCollect(stream);

    return results[results.length - 1]!.result;
  });

/**
 * The tools return refusals rather than failing, so the assertions are about
 * values. These two narrow the union and say which outcome was expected.
 */
const succeeded = <A>(result: A): Exclude<A, ToolRefused | AiError.AiError> => {
  expect(result, "the tool refused").not.toBeInstanceOf(ToolRefused);

  return result as Exclude<A, ToolRefused | AiError.AiError>;
};

const refused = (result: unknown, required: string) => {
  expect(result).toBeInstanceOf(ToolRefused);
  expect(result).toMatchObject({ _tag: "ToolRefused", required });
};

const seed = Effect.fnUntraced(function*(org: string, contacts: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into "organization" ("id", "name", "slug", "createdAt")
             values (${org}, ${org}, ${org}, now()) on conflict ("id") do nothing`;

  for (const name of contacts) {
    yield* withOrgScopeFor(
      org,
      sql`insert into "contact" ("id", "organizationId", "email", "fullName")
          values (${`${org}_${name}`}, ${org}, ${`${name}@example.com`}, ${name})
          on conflict ("id") do nothing`,
    );
  }
});

describe.skipIf(testDbUrl() === undefined)("the agent toolkit", () => {
  it.layer(as("agent_a", "owner"))("as an owner", (it) => {
    it.effect("reports who the caller is", () =>
      Effect.gen(function*() {
        yield* seed("agent_a", []);

        const caller = succeeded(yield* call("WhoAmI"));

        expect(caller.organizationId).toBe("agent_a");
        expect(caller.role).toBe("owner");
        expect(caller.plan).toBe("free");
        expect(caller.permissions).toContain("contact:read");
      }));

    /**
     * The assertion that matters most. The tool is a fourth transport over
     * `ContactStore`, which is org-scoped — so a model cannot reach another
     * tenant's rows even if it asks for them by name.
     */
    it.effect("sees only its own organization's contacts", () =>
      Effect.gen(function*() {
        yield* seed("agent_a", ["ada"]);
        yield* seed("agent_b", ["grace"]);

        const contacts = succeeded(yield* call("ListContacts"));

        expect(contacts.map((contact) => contact.fullName)).toEqual(["ada"]);
      }));

    it.effect("searches by name or address, case-insensitively", () =>
      Effect.gen(function*() {
        yield* seed("agent_a", ["ada", "alan"]);

        expect(succeeded(yield* call("SearchContacts", { query: "AD" })).map((row) => row.fullName))
          .toEqual(["ada"]);
        expect(succeeded(yield* call("SearchContacts", { query: "nobody" }))).toEqual([]);
      }));

    it.effect("writes through the same store the product uses", () =>
      Effect.gen(function*() {
        yield* seed("agent_a", []);

        const created = succeeded(
          yield* call("CreateContact", {
            email: "katherine@nasa.test",
            fullName: "Katherine Johnson",
          }),
        );

        expect(created.email).toBe("katherine@nasa.test");
        expect(succeeded(yield* call("ListContacts")).map((row) => row.email))
          .toContain("katherine@nasa.test");
      }));
  });

  /**
   * A tool refusal is a value the model reads, not a defect that kills the
   * process — and it names the permission, so the model can tell the person
   * what to ask an admin for instead of inventing a reason.
   */
  it.layer(as("agent_readonly", "member", ["contact:read"]))("as a read-only caller", (it) => {
    it.effect("is refused a write, by name", () =>
      Effect.gen(function*() {
        yield* seed("agent_readonly", []);

        refused(
          yield* call("CreateContact", { email: "no@example.com", fullName: "No" }),
          "contact:create",
        );
      }));

    it.effect("is refused the files it may not read", () =>
      Effect.gen(function*() {
        yield* seed("agent_readonly", []);

        refused(yield* call("ListFiles"), "file:read");
      }));
  });
});

describe("the toolkit's declarations", () => {
  /**
   * Every write is proposed to the person before it runs. The permission check
   * decides whether they *may*; approval decides whether they meant to, and a
   * model that misreads an instruction is acting entirely within its
   * permissions while doing the wrong thing.
   */
  it("requires approval for the tool that writes, and not for the ones that read", () => {
    expect(AgentToolkit.tools.CreateContact.needsApproval).toBe(true);

    // Left unset rather than set to false, which is how the library spells it.
    for (const name of ["WhoAmI", "ListContacts", "SearchContacts", "ListFiles"] as const) {
      expect(AgentToolkit.tools[name].needsApproval, `${name} asks for approval`)
        .not.toBe(true);
    }
  });

  it("describes every tool, because the descriptions are what a model chooses from", () => {
    for (const [name, tool] of Object.entries(AgentToolkit.tools)) {
      expect(tool.description, `${name} has no description`).toBeDefined();
      expect(tool.description!.length, `${name}'s description is too short to choose from`)
        .toBeGreaterThan(40);
    }
  });
});
