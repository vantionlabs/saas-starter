# Directory provisioning (SCIM)

Single sign-on decides **who may sign in**. SCIM decides **who exists**. A
customer buying both expects somebody removed from their directory on a Friday
to lose access without anybody here being told — which is the half SSO cannot
do, and the half an enterprise security review asks about.

`@better-auth/scim`, pinned to better-auth's own minor the way `@better-auth/sso`
is. SCIM 2.0 is a specification with a body of expected behaviour — filters,
`PATCH` operations, `ListResponse` envelopes, its own error shape — and a
hand-written router beside a library that already speaks it is how the two come
to disagree.

Users only. Groups are not provisioned, so **roles stay yours to set** in
`/settings/members`: an identity provider that could mint admins would make the
organization's permission model a property of somebody else's directory, which
is the same reason `organizationProvisioning.defaultRole` is `member` for SSO.

## Connecting one

`/settings/scim` generates a token and shows it **once**. An administrator pastes
that and the SCIM base URL into Okta, Entra or OneLogin:

```
Base URL:  https://api.example.com/api/auth/scim/v2
Token:     the one the screen showed
```

The provider id is generated rather than asked for. It is an opaque handle an
identity provider never sees — the token carries it — and a field for it would
be a form asking somebody to name something they will never refer to again.

## Three defaults changed, and why each one

**`storeSCIMToken: "hashed"`.** The plugin's default is `plain`. That would put a
credential able to create and disable users across an organization into the
database in readable form — the same mistake `apiKey` avoids by storing only a
hash, and worse, because this one is long-lived and belongs to a machine that
will never notice it has leaked. The cost is honest: a token cannot be shown
again, so "rotate" is remove-and-generate. A test asserts the column does not
contain what was handed out.

**Personal tokens are refused.** `canGenerateToken` requires an organization. The
plugin's own documentation says organization-less token creation is "otherwise
available to any authenticated user", and a SCIM token can provision and disable
people. In a B2B product there is no personal directory for one to belong to, so
the answer is not a narrower rule — it is that the shape does not exist here.

**`linkExistingUsers: false`**, which is the plugin's default and worth keeping
deliberately. Enabling it would let a SCIM token claim an account whose email
happens to match — one it never provisioned, possibly in another organization
entirely. A directory pushing `ada@example.com` would be handed whoever already
signed up with that address. A conflict is returned instead.

## The seat limit, and where it had to go

`membershipLimit` guards better-auth's **invitation** endpoints. SCIM does not go
through them: it inserts a `member` row through the adapter directly. Without a
check of our own, a directory of five hundred people fills an organization sold
three seats and nothing says no — revenue, and the easiest way to grow this
database from outside.

The check is a `databaseHooks.user.create.before`, and **where** it sits is the
part worth knowing. The first version was a `before` hook on `/scim/v2/Users`,
which reads the organization out of the bearer token. It worked, and it answered
a _forged_ token with "this organization has no seats left" instead of
"unauthorized" — a fact about a tenant handed to somebody who failed to
authenticate. A test pinned that, and the check moved inside the handler, where
`authenticatedScimOrganization` reads the provider the plugin has already
verified.

Blocking the _user_ is enough because linking is off: a SCIM request that would
add somebody to an organization is always one that creates them.

## What a provisioned account is

A row in `user` with no password, an `account` row linking it to the provider,
and a `member` row in the token's organization. They sign in through SSO; there
is no credential to set, which is why writing `user` directly is right here and
wrong in `pnpm seed`.

They also get a **personal organization**, because every account here does —
`databaseHooks.user.create.after` is unconditional and the product has no orgless
state to represent. Worth knowing before a directory of five hundred arrives: it
is five hundred more organizations, each with one member.

Deactivation (`active: false`, or a `DELETE`) bans the account and drops its
sessions, so access ends on the next request rather than at the next token
expiry.

## What is not built

- **Groups.** `/scim/v2/Groups` is not served, so role assignment stays in the
  product. That is a deliberate boundary, not an omission — see above.
- **A verified end-to-end run.** No real identity provider has been pointed at
  this repository. The endpoints, the token, the seat limit and the refusals are
  tested against better-auth's own handler; what has not been proven is that
  Okta's particular dialect of SCIM is happy with it. Say so before promising a
  customer a date.

## Row-level security

`scimProvider` has none, for exactly the reason `0011_sso.sql` gives for
`ssoProvider`: better-auth writes it from its own endpoints, outside any
`withOrgScope` transaction, so a policy in the usual shape would refuse its
inserts and one that made room for a null `app.current_org` would permit every
unscoped read while still reporting `relrowsecurity` as true — the appearance of
defence. What protects it is that nothing in this application reads the table:
the plugin's endpoints are the only path, and they check membership and role.
