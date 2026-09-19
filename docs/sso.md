# Single sign-on

`@better-auth/sso`, configured **per organization**: one tenant is on Okta, the
next on Entra, and both arrive at the same deployment. A provider carries the
organization that owns it and the email domain that routes to it, so
`/sign-in/sso` takes an address and finds the right identity provider without
asking a person to pick their employer out of a list of everybody else's.

OIDC and SAML 2.0 both. The plugin registers the SAML service-provider metadata,
assertion consumer and single-logout endpoints alongside the OIDC callback, so
which protocol a customer speaks is their choice rather than a build decision.

## Who may turn it on

Two questions, asked separately, because they fail separately.

**May this person?** Owner or admin. That is `hasOrgAdminRole` inside the
plugin's own `/sso/register` handler, and `Permission.ts` carries `sso:read` and
`sso:manage` with the same grants **deliberately**, so our screens ask the
question better-auth will ask again. It is looser than `billing:manage`, which
only the owner holds. That is not an oversight: better-auth owns the endpoint, so
a tighter rule on our side is one a request straight to
`/api/auth/sso/register` walks past. Tightening it means changing both.

**May this organization?** `feature("sso")`, which is on the `scale` plan in the
example split. better-auth cannot answer this — a plan lives in a table its
plugin has never heard of — so it is a `before` hook in `auth/Options.ts` that
calls `ssoEntitled`, resolved per request so an upgrade takes effect on the next
registration rather than the next deploy. Same shape as the seat limit, same
reason.

## The domain must be proved

`domainVerification` is **enabled**, and it is the whole security story rather
than a nicety. Without it, anybody who may register a provider can claim
`acme.com` and become the identity provider for everyone whose address ends that
way — account takeover with a settings form in front of it.

So a provider exists as soon as it is registered and routes nothing until DNS
carries the token the registration returns. `trustEmailVerified` is left off for
the same reason; better-auth deprecates it and says why.

A test asserts a freshly registered provider has `domainVerified` false. That is
the assertion worth keeping: the failure it guards against is silent, because a
provider that works too early works exactly like one that works.

## Discovery, and why the screen does not use it

An OIDC provider can be registered two ways.

**By discovery** — give the issuer and let the server fetch
`/.well-known/openid-configuration`. better-auth checks that URL against
`trustedOrigins` before fetching it, and refuses otherwise. It is right to: the
URL comes from whoever is registering the provider, and fetching an arbitrary one
from inside your network is a request-forgery primitive. The consequence is that
discovery cannot be self-serve — trusting a customer's IdP is an operator's
decision, so `SSO_DISCOVERY_ORIGINS` is a comma-separated list and changing it is
a restart.

**By explicit endpoints**, with `skipDiscovery` — authorization, token and JWKS
pasted from the identity provider's own admin console, which is where an
administrator is already standing. These need only be publicly routable, no
server-side fetch happens at registration, and adding a customer becomes a row
rather than a deployment.

The starter does the second. The first is supported for deployments that prefer
it, and empty by default.

## The table has no row-level security, deliberately

`ssoProvider` is the first organization-owned table here without a policy, and
`0011_sso.sql` carries the reasoning in full. In short: every policy in this
schema keys on `app.current_org`, which `withOrgScope` sets per transaction, and
better-auth writes this table from its own connection outside any such
transaction. A policy in the usual shape would refuse its inserts. A policy that
also permitted a null setting would permit every unscoped read in the process
while still reporting `relrowsecurity` as true — the appearance of defence, which
is worse than none, because the appearance is what stops somebody looking again.

What stands in its place is the plugin's own membership check, and a test proves
it holds: a caller who is not a member of the organization cannot register a
provider for it. The same reasoning already applies to `member`, `invitation`
and `organizationRole`, which carry no policy for the same reason.

## What has been verified here, and what has not

`packages/modules/iam/test/Sso.test.ts` drives the real better-auth handler
against the real schema: the entitlement refusal, a successful registration that
lands unverified, and the cross-tenant refusal.

**No sign-in has been performed against a real identity provider in this
repository** — neither OIDC nor SAML. That needs an Okta or Entra tenant and a
verified domain, which a test suite cannot conjure. The registration path and its
authorisation are covered; the round trip through somebody's IdP is not, and the
first person to point this at Okta will be the first person to see it work.

`samlify` does the SAML cryptography, and `@better-auth/sso` sets
`InResponseTo` validation on by default so an unsolicited or replayed assertion is
refused. Both are worth knowing about when a security review asks who verifies
the signature: it is not this repository.
