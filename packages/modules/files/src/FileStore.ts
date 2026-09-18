import { CurrentUser } from "@vantion/module-iam/identity/Identity";
import { withOrgScope } from "@vantion/module-iam/identity/OrgScope";
import { Effect, Option } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { FileId, StoredFile } from "./FilesRpc.js";

type Row = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: string;
  readonly status: "pending" | "ready";
  readonly createdAt: Date;
};

/**
 * `size` arrives as a string because the column is `bigint`, which node-postgres
 * will not narrow to a JavaScript number on its own — and it is right not to.
 * Files are well inside the safe range, so the conversion happens here, once.
 */
const toFile = (row: Row) =>
  new StoredFile({
    id: FileId.make(row.id),
    name: row.name,
    contentType: row.contentType,
    size: Number(row.size),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  });

const columns = `"id", "key", "name", "contentType", "size", "status", "createdAt"`;

/** Every file the caller's organization has, newest first. */
export const listFiles = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<Row>`
    select ${sql.literal(columns)} from "file"
    where "organizationId" = ${orgId} and "status" = 'ready'
    order by "createdAt" desc
  `).pipe(Effect.orDie);

  return rows.map(toFile);
});

/** One file, if it belongs to the caller's organization. */
export const findFile = (id: FileId) =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient;
    const { orgId } = yield* CurrentUser;

    const rows = yield* withOrgScope(sql<Row>`
      select ${sql.literal(columns)} from "file"
      where "organizationId" = ${orgId} and "id" = ${id}
    `).pipe(Effect.orDie);

    return Option.fromUndefinedOr(rows[0]);
  });

/** What the organization is already using, in bytes. */
export const bytesUsed = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient;
  const { orgId } = yield* CurrentUser;

  const rows = yield* withOrgScope(sql<{ total: string; }>`
    select coalesce(sum("size"), 0)::text as "total" from "file"
    where "organizationId" = ${orgId}
  `).pipe(Effect.orDie);

  return Number(rows[0]?.total ?? 0);
});

export { toFile };
export type { Row };
