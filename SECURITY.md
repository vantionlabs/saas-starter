# Security

## Reporting a vulnerability

Email **hello@vantion.co** with "Security" in the subject. Include a
description, the affected commit, and steps to reproduce. Please do not open a
public issue.

We aim to reply within a few working days, confirm the issue, agree a
disclosure date with you, and credit you in the release notes unless you prefer
not to be named.

## Scope

In scope: code in this repository. This is a starter, so a flaw here is
inherited by everything built from it — which makes the boring parts worth more
attention than the interesting ones. The places to look first, roughly in order
of what a mistake would cost:

**Tenant isolation.** Postgres row-level security on tenant tables
(`packages/database/src/migrations/0002_rls.sql`) and `withOrgScope`
(`packages/database/src/OrgScope.ts`) around the queries that touch them.
Neither is trusted alone. The escapes are deliberate and few — `withWorkerScope`
exists for the lookups that must resolve a tenant before one is known, such as
authenticating an API key — and each is the kind of thing worth reading twice.
`e2e/tests/tenancy.spec.ts` is the end-to-end check that the whole stack keeps
two real users apart.

**The permission model.** `packages/domain/src/iam/Permission.ts` declares
resources and actions once, and both the RPC policies and better-auth's own
endpoint checks are built from it, so the two cannot disagree about who may do
what. A path that authorises without going through `Policy` is a bug.

**Auth rate limiting.** `apps/server/src/iam/AuthHttp.ts` throttles the
credential endpoints, and on the OTP path that limit _is_ the security boundary:
a six-digit code carries about twenty bits, so it is only as strong as the
number of attempts allowed. Callers are identified by
`apps/server/src/iam/ClientAddress.ts`, which reads `X-Forwarded-For` only when
`TRUST_PROXY` says a proxy is in front, and counts entries from the right so a
client cannot forge the one that is used. Setting `TRUST_PROXY` higher than the
number of proxies you actually run reopens that hole.

**API keys.** `apps/server/src/api/ApiKeyAuth.ts` and
`packages/domain/src/iam/ApiKey.ts`. Only a hash is stored; the secret is shown
once. A key resolves through the same permission model as a member.

**The audit trail.** `packages/domain/src/iam/Audit.ts` records fields by
allowlist, not by denylist, specifically so a new field cannot start logging
something — a webhook signing secret, a token — by being added. Widening that
list is a security change.

**Session handling.** The browser talks to the API directly, so the session
cookie is cross-origin: `AUTH_COOKIE_DOMAIN`, the single permitted CORS origin,
and better-auth's trusted-origin check are load-bearing together.

Out of scope: the vendored upstream source under `repos/`, which is read-only
reference material and belongs to its own projects; anything requiring a
compromised developer machine; and findings that depend on a deployment
misconfiguring the variables documented in `.env.example`.
