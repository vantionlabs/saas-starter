-- Single sign-on providers, one per organization and identity provider.
--
-- `ssoProvider` is better-auth's, generated with `compileAuthMigrations` after
-- adding `@better-auth/sso` to the plugin set in `auth/Options.ts`. Two things
-- below are ours rather than generated, and both are stated here because a
-- regenerated copy would silently drop them.

create table if not exists "ssoProvider" (
  "id" text not null primary key,
  "issuer" text not null,
  "oidcConfig" text,
  "samlConfig" text,
  "userId" text not null references "user" ("id") on delete cascade,
  "providerId" text not null unique,
  -- Generated as plain text: the plugin's schema does not declare a reference.
  -- The cascade is ours. Without it, deleting an organization leaves a provider
  -- still routing its email domain somewhere, which is a sign-in that succeeds
  -- into a tenant that no longer exists.
  "organizationId" text references "organization" ("id") on delete cascade,
  "domain" text not null,
  -- Null until DNS proves the domain. `domainVerification` is enabled, so an
  -- unverified provider exists but cannot be signed in through.
  "domainVerified" boolean
);

-- The sign-in path is "an email address arrives, find its provider", so the
-- domain is the lookup and not just a label.
create index if not exists "ssoProvider_domain_idx" on "ssoProvider" ("domain");
create index if not exists "ssoProvider_organizationId_idx" on "ssoProvider" ("organizationId");

-- No row-level security on this table, deliberately, and it is the first
-- organization-owned table here without it.
--
-- Every RLS policy in this schema keys on `app.current_org`, which `withOrgScope`
-- sets per transaction. better-auth writes this table from its own connection,
-- outside any such transaction, so a policy in the usual shape would refuse its
-- inserts — registering a provider would fail with a row-level security error
-- and nothing would say why.
--
-- The alternative, a policy that also permits when the setting is null, is
-- worse: it would permit every unscoped read in the process while still
-- reporting `relrowsecurity` as true. That is not defence in depth, it is the
-- appearance of it, and the appearance is what stops somebody looking again.
--
-- So isolation here is the plugin's own: `/sso/register` refuses a caller who is
-- not an owner or admin of the organization, and `/sso/providers` returns only
-- the organizations the caller administers. The same reasoning already applies
-- to `member`, `invitation` and `organizationRole`, which are better-auth's for
-- the same reason and carry no policy either. Anything of ours that reads this
-- table filters on "organizationId" explicitly, and a test proves it.
