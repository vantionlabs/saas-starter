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

## Staff are a system role, not an organization role

`user.role`, which better-auth's `admin` plugin owns, and nothing to do with
`member.role` — somebody can be the owner of their own organization and not
staff, or staff and a member of nothing. `StaffResolver` reads it per request
rather than trusting a session payload, so revoking it takes effect on somebody's
next request instead of whenever their session expires, and it honours `banned`
for the same reason.

"Not signed in" and "signed in but not staff" are the **same** answer,
`NotStaff`. Distinguishing them would confirm to an anonymous caller that the
second state exists and that a given account is or is not in it.

Nobody is staff until somebody is made staff, and there is deliberately no way
to do that through the product:

```sql
update "user" set "role" = 'admin' where "email" = 'you@example.com';
```

A flow that could grant it is a flow that could grant it to anybody.

**The plugin's endpoints are mounted on the customer-facing API**, which is a
decision rather than an oversight. The alternative is a second better-auth
instance over one `user` table, which is the arrangement where two systems
quietly disagree about who somebody is. What makes it safe is the layer
underneath: a session that somehow became `role: "admin"` on `apps/server`
gains better-auth's user management and **no tenant data at all**, because that
process connects as `vantion` and cannot bypass a policy whatever it is asked
to do. The two controls compose — one decides who you are, the other decides
what the connection can see.

## Counts, never contents

`GetOrganization` returns how many contacts, files, API keys and endpoints an
organization has, and not one of their rows. Everything an admin procedure
returns crosses the tenant boundary, so the bar for adding a field is what
somebody cannot do their job without — "is their import stuck" needs the number
nine hundred, not nine hundred names. A test asserts a seeded contact's address
does not appear in the response.

`OrganizationNotFound` is a typed outcome rather than a defect: the panel links
from a list into a detail page, an organization can be deleted between the two,
and a stale link is something a screen renders rather than a crash. The record
of the attempt is written first and stays written — a trail keeping only the
successful reads would be missing exactly the ones worth reviewing.

That last point cost a schema change. `adminAudit.organizationId` originally had
a foreign key, which refuses an id that never existed — so probing for
identifiers produced a constraint error instead of a row, and the one read
nobody could explain was the one read nobody could see. An audit row is a
statement about the past; a foreign key makes it a statement about the present.

## What exists, and what does not

The seam and its proofs: `packages/modules/admin/test/CrossTenant.test.ts`
asserts that the application's connection sees nothing unscoped, that the admin
connection sees across tenants, that a read without a reason is refused before
it runs, that the record names who looked at what, and that the application can
neither read nor forge a row of the staff trail.

The module is complete and serveable: `AdminModule` carries
`ListOrganizations` and `GetOrganization` over the admin connection, and leaves
`CurrentStaff` in its requirements because who is asking is the host's to
establish.

**There is no admin application yet.** No `apps/admin`, no screens, and no
process registering `AdminModule` — `apps/server` does not and must not — so
nothing is served and `ADMIN_DATABASE_URL` is unset everywhere including CI.
What lands next is the application: a TanStack Start app serving these
procedures from its own process, so the credential never sits beside customer
traffic.

Also owed, and worth naming: when a staff action concerns exactly one
organization, that organization's own `auditEntry` should carry it too. A
customer asking "did anyone at your company look at our data" deserves to answer
it from the same screen they read everything else in.
