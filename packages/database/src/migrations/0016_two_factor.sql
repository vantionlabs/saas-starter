-- A second factor, available to everybody and required of staff.
--
-- better-auth's `two-factor` plugin, generated with `compileAuthMigrations`.
-- `if not exists` on each statement rather than the bare form the generator
-- emits, because every migration here is idempotent: applying the whole set to
-- any database converges it, and there is no ledger saying what has run.
--
-- `twoFactor` holds the TOTP secret and the backup codes, and neither is ever
-- returned by the API — the plugin marks both `returned: false`. They are still
-- secrets at rest in this table, so a database dump is a 2FA bypass and should
-- be treated as one.

alter table "user" add column if not exists "twoFactorEnabled" boolean;

create table if not exists "twoFactor" (
  "id" text not null primary key,
  "secret" text not null,
  "backupCodes" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "verified" boolean,
  -- The plugin locks an enrolment out after enough wrong codes, which is what
  -- stops a six-digit second factor being brute-forced the way the first one
  -- cannot be.
  "failedVerificationCount" integer,
  "lockedUntil" timestamptz
);

create index if not exists "twoFactor_secret_idx" on "twoFactor" ("secret");
create index if not exists "twoFactor_userId_idx" on "twoFactor" ("userId");

-- No row-level security, for the same reason `user` and `session` have none:
-- better-auth writes this table from its own connection, outside any
-- `withOrgScope` transaction, and it is not tenant-owned — a second factor
-- belongs to a person, not to an organization. `0011_sso.sql` makes the same
-- argument at length.
