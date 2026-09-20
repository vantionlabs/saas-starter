-- Directory provisioning: an identity provider pushing users into a workspace.
--
-- The shape is `@better-auth/scim`'s own, because the plugin owns these rows —
-- the same arrangement `0011_sso.sql` describes for `ssoProvider`. Declaring
-- them here rather than letting better-auth migrate keeps every table this
-- database has in one reviewable place.
--
-- `providerId` and `scimToken` are both unique, which is the plugin's doing and
-- worth understanding: the bearer token an identity provider sends is
-- `base64url(token:providerId:organizationId)`, so the provider id is looked up
-- from the credential itself rather than from a path or a header of its own.
--
-- `scimToken` holds a **hash**, not the token. The plugin's default is `plain`
-- and `auth/Options.ts` sets `storeSCIMToken: "hashed"` instead: this column is
-- a credential that can create and disable users across an organization, and a
-- readable copy of it in the database is the same mistake `apiKey` avoids by
-- storing only a hash. Rotating means deleting the connection and generating
-- another, which is the honest consequence and what the screen offers.
--
-- `organizationId` is nullable because the plugin supports personal
-- (organization-less) tokens. This deployment refuses to issue them —
-- `canGenerateToken` in `auth/Options.ts` says why — but the column stays
-- nullable so the plugin's own queries work unchanged.

create table if not exists "scimProvider" (
  "id" text not null primary key,
  "providerId" text not null unique,
  "scimToken" text not null unique,
  "organizationId" text references "organization" ("id") on delete cascade
);

create index if not exists "scimProvider_organizationId_idx"
  on "scimProvider" ("organizationId");

-- No row-level security, for exactly the reason `0011_sso.sql` gives at length
-- for `ssoProvider`: better-auth writes this table from its own endpoints,
-- outside any `withOrgScope` transaction, so a policy in the usual shape would
-- refuse its inserts. One that made room for a null `app.current_org` would
-- permit every unscoped read while still reporting `relrowsecurity` as true,
-- which is the appearance of defence and worse than none.
--
-- What protects it instead is that nothing in this application reads it: the
-- plugin's endpoints are the only path, and they check organization membership
-- and role before returning a connection.
