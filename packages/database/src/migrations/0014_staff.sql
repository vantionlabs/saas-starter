-- Staff, which is a different thing from an organization's owner.
--
-- better-auth's `admin` plugin, generated with `compileAuthMigrations`. `role`
-- here is a **system** role and has nothing to do with `member.role`, which is
-- somebody's standing inside one organization: a person can be an owner of
-- their own organization and not staff, or staff and a member of nothing.
--
-- `if not exists` on each column rather than the bare `add column` the
-- generator emits, because every migration in this directory is idempotent —
-- applying the whole set to any database converges it, and there is no ledger
-- saying what has already run.

alter table "user" add column if not exists "role" text;
alter table "user" add column if not exists "banned" boolean;
alter table "user" add column if not exists "banReason" text;
alter table "user" add column if not exists "banExpires" timestamptz;
alter table "session" add column if not exists "impersonatedBy" text;

-- Nobody is staff until somebody is made staff, and there is deliberately no
-- way to do that through the product: it is one statement, run by whoever holds
-- the database.
--
--   update "user" set "role" = 'admin' where "email" = 'you@example.com';
--
-- A sign-up flow that could grant it would be a sign-up flow that could grant
-- it to anybody.
create index if not exists "user_role_idx" on "user" ("role") where "role" is not null;
