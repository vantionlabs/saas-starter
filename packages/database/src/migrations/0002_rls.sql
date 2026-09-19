-- Row-level security, as defence in depth behind application-level org scoping.
--
-- `contact` is the first org-scoped application table and the carrier for the
-- policy; every later tenant table follows the same three statements.
--
-- FORCE is essential: without it Postgres exempts the table owner, which is the
-- role the application connects as, so the policy would never apply.
--
-- FORCE is still not enough on its own. Superusers, and any role holding
-- BYPASSRLS, ignore row-level security entirely. DATABASE_URL must therefore
-- point at an unprivileged role: `docker compose` bootstraps as `postgres` and
-- `src/roles/init.sql` makes `vantion`, which is NOBYPASSRLS and is what the
-- application connects as.
--
-- This paragraph used to claim that was already the case and it was not. The
-- compose file set POSTGRES_USER to `vantion`, which makes it the bootstrap
-- *superuser* — so every policy in this schema was inert, locally and in the
-- test suite, while `pg_class.relrowsecurity` read true. Connecting as a
-- superuser disables all of this silently, which is why
-- `packages/database/test/Role.test.ts` now asserts the connection cannot.

create table if not exists "contact" (
  "id" text not null primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  "email" text not null,
  "fullName" text not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists "contact_organizationId_idx" on "contact" ("organizationId");

alter table "contact" enable row level security;
alter table "contact" force row level security;

-- `app.current_org` is set per transaction by `withOrgScope`. `current_setting`
-- with the missing_ok flag returns NULL outside a scoped transaction, and
-- NULL = NULL is never true, so an unscoped query sees nothing at all.
drop policy if exists "contact_org_isolation" on "contact";
create policy "contact_org_isolation" on "contact"
  using ("organizationId" = current_setting('app.current_org', true))
  with check ("organizationId" = current_setting('app.current_org', true));
