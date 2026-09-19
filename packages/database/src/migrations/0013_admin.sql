-- The staff record, and the one table in this schema nobody may read.
--
-- An admin panel is cross-tenant by nature: it exists to answer questions about
-- organizations other than your own, which is precisely what every other policy
-- here forbids. That makes *which connection may do it* the whole control, and
-- it is `ADMIN_DATABASE_URL` — the `admin` role, the only one provisioned with
-- BYPASSRLS.
--
-- Two things follow, and they are both in this file.

create table if not exists "adminAudit" (
  "id" text not null primary key,
  "staffUserId" text not null,
  "staffEmail" text not null,
  "action" text not null,
  -- The organization the action concerned, when it concerned exactly one.
  -- Null for a genuinely cross-tenant read such as listing every organization.
  --
  -- No foreign key, and `0015_admin_audit_id.sql` says why at length: this
  -- records what was *asked for*, which includes ids that never existed.
  "organizationId" text,
  -- Why. Not optional, and not derivable — a support engineer opening a
  -- customer's data should have to type the ticket number, and a log of reads
  -- with no reasons in it is a log nobody can review.
  "reason" text not null,
  "at" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "adminAudit_reason_present" check (length(btrim("reason")) > 0)
);

create index if not exists "adminAudit_at_idx" on "adminAudit" ("at" desc);
create index if not exists "adminAudit_organizationId_idx" on "adminAudit" ("organizationId");

-- A policy that is never true.
--
-- Every other policy here answers "which organization's rows may this caller
-- see". This one answers "none of them, ever" — so the application role, which
-- owns the table because it runs the migrations, cannot read or write a single
-- row of it. Only a role holding BYPASSRLS can, and `admin` is the only one.
--
-- That is the point. A staff audit trail the application can write to is one a
-- compromised application can rewrite, and the record of who read a customer's
-- data is worth less than nothing if the process that might have leaked it
-- could also edit the evidence.
alter table "adminAudit" enable row level security;
alter table "adminAudit" force row level security;
drop policy if exists "adminAudit_admin_only" on "adminAudit";
create policy "adminAudit_admin_only" on "adminAudit" using (false) with check (false);
