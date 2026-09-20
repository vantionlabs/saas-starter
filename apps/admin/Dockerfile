# The admin panel, and the only image that is ever given `ADMIN_DATABASE_URL`.
#
#   docker build -f apps/admin/Dockerfile -t vantion-admin .
#
# Built from the repository root for the same reason every other image here is:
# a workspace package resolves against the root lockfile and every sibling
# manifest.
#
# This is a separate deployable rather than a route inside `apps/web`, and the
# separation is the control. A distinct origin can sit behind a VPN, an IP
# allowlist, or simply off the public internet — a route cannot be any of
# those — and a cross-site scripting hole in the customer product cannot reach
# it. The credential that can read across tenants lives only here.
#
# It talks to the API for one thing: resolving a session. Everything else runs
# in this process, against its own connection.

FROM oven/bun:1.4.2-debian AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
# Every workspace package this image's build reaches, and no more.
# `tooling/test/docker.test.ts` computes the set and fails with the lines
# to paste, so this block is generated rather than remembered.
COPY apps/admin/package.json apps/admin/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/emails/package.json packages/emails/
COPY packages/modules/admin/package.json packages/modules/admin/
COPY packages/modules/agent/package.json packages/modules/agent/
COPY packages/modules/assistant/package.json packages/modules/assistant/
COPY packages/modules/billing/package.json packages/modules/billing/
COPY packages/modules/contact/package.json packages/modules/contact/
COPY packages/modules/files/package.json packages/modules/files/
COPY packages/modules/health/package.json packages/modules/health/
COPY packages/modules/iam/package.json packages/modules/iam/
COPY packages/modules/jobs/package.json packages/modules/jobs/
COPY packages/modules/notifications/package.json packages/modules/notifications/
COPY packages/modules/webhooks/package.json packages/modules/webhooks/
COPY packages/telemetry/package.json packages/telemetry/
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
COPY scripts/package.json scripts/
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
# Two steps, and the split is the point.
#
# `tsc -b` once over this image's own tsconfig, which follows project references
# and therefore builds every package the app reaches. Then the bundles, which
# are independent and may run at once.
#
# pnpm needed `--workspace-concurrency=1` here: it fanned `build` out across
# packages, each starting its own `tsc -b`, and several reference the same
# projects — two processes writing one project's output and `.tsbuildinfo` while
# a third read it half-written, surfacing as `error TS2306: File 'src/PgTest.ts'
# is not a module` on a file that is one. bun has no such flag and does not need
# one: with the type build hoisted out there is only ever one `tsc`. The race is
# gone by construction rather than serialised around.
#
# A workspace package resolves to `build/src/*.js` under its `default` condition
# and `.dockerignore` keeps build output out of the context, so a value imported
# from one does not resolve until something has built it — while every type-only
# import beside it is erased and does not notice.
# `tooling/test/docker.test.ts` asserts the manifest set matches this closure.
RUN bunx tsc -b apps/admin/tsconfig.json
RUN bun run --filter @vantion/admin bundle

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5174

COPY --from=build /app/apps/admin/.output ./apps/admin/.output

WORKDIR /app/apps/admin
EXPOSE 5174
CMD ["bun", ".output/server/index.mjs"]
