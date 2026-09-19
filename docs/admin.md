# The admin surface

Cross-tenant by nature. Every other part of this system is built so that a
request can only ever see one organization's rows; an admin panel exists to see
the others. That makes it the one place where the guarantee is deliberately
suspended, and the only interesting question is what suspends it.

## The connection is the control

Two database roles, provisioned in `packages/database/src/roles/init.sql`:

| Role      | Bypasses RLS | Used by                                              |
| --------- | ------------ | ---------------------------------------------------- |
| `vantion` | no           | `apps/server`, `apps/worker`, `apps/web` — all of it |
| `admin`   | **yes**      | the admin application, and nothing else              |

`ADMIN_DATABASE_URL` names the second. `AdminSql` is a **separate service tag**
from `SqlClient`, not a second implementation of it: a handler asking for
`SqlClient` gets the scoped connection, and the only way to reach the other is
to name it — which a customer-facing module has no reason to do and, in a
process without that variable, no way to get.

There is no flag, no middleware and no lint rule by which one becomes the other.
They hold different credentials, and Postgres is what decides.

`layerAdminSql` therefore **refuses** when the variable is unset. Every other
external boundary here has a credential-free fallback — the mailer logs, the
queue runs in memory, storage writes to a directory — because a fresh clone
should work. This one must not have one: the only thing to fall back to is the
application's own connection, and a deployment that silently downgraded would
look exactly like one that worked.

## Every cross-tenant read leaves a record

`crossTenant(action, read)` is the only way to use that connection, and it takes
three things: what is being done, which organization it concerns if it concerns
one, and **why**.

The reason is not optional. A support engineer opening a customer's data should
have to type the ticket number, and a log of reads with no reasons in it is one
nobody can review — every line says somebody looked and none says whether they
should have.

The record is written **first, in the same transaction as the read**. A read
that succeeded therefore cannot have gone unrecorded: if the audit write fails
the read does not happen, and if the read fails the record rolls back with it.
Writing afterwards would mean a crash mid-query leaves a customer's data read
and nothing saying so, which is the outcome the whole arrangement exists to
prevent.

It takes the read rather than returning a client for the same reason. A function
handing back `AdminSql` is one somebody calls once and then uses forever.

## Nobody may read the staff trail

`adminAudit` carries a policy that is never true:

```sql
create policy "adminAudit_admin_only" on "adminAudit" using (false) with check (false);
```

Every other policy in this schema answers "which organization's rows may this
caller see". This one answers "none, ever" — so the application role, which owns
the table because it runs the migrations, can neither read nor write a row of
it. Only a role holding BYPASSRLS can.

A staff audit trail the application can write to is one a compromised
application can rewrite, and the record of who read a customer's data is worth
less than nothing if the process that might have leaked it could also edit the
evidence.

## Staff are not an `Identity`

`Identity` carries an `orgId` and the permissions resolved within it, because
every other caller in this system acts inside exactly one organization — that is
what makes `withOrgScope` safe and what the schema's policies key on.

`Staff` is its own type rather than an `Identity` with a flag. A flag would mean
every handler taking an `Identity` could be reached by a caller for whom the
tenant field is meaningless, and the compiler would have nothing to say about
it.

## What exists, and what does not

The seam and its proofs: `packages/modules/admin/test/CrossTenant.test.ts`
asserts that the application's connection sees nothing unscoped, that the admin
connection sees across tenants, that a read without a reason is refused before
it runs, that the record names who looked at what, and that the application can
neither read nor forge a row of the staff trail.

**There is no admin application yet.** No `apps/admin`, no authentication for
staff, no screens, and no procedures beyond the seam — so nothing is served and
`ADMIN_DATABASE_URL` is unset everywhere including CI. What lands next is the
application that uses this, and with it the question this file does not yet
answer: how somebody proves they are staff.

Also owed, and worth naming now: when a staff action concerns exactly one
organization, that organization's own `auditEntry` should carry it too. A
customer asking "did anyone at your company look at our data" deserves to answer
it from the same screen they read everything else in.
