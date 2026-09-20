# The marketing site, server-rendered.
#
# Built from the repository root, like every other image here:
#
#   docker build -f apps/marketing/Dockerfile -t vantion-marketing .
#
# It was an nginx image serving a prerendered page until this app became
# multi-page. Once there are several routes, each with its own title, canonical
# and Open Graph tags — and a sitemap to serve — rendering on the server is the
# simpler thing, not the heavier one.

# Debian rather than Alpine: `prepare` runs `effect-tsgo patch`, whose packaged
# Oxlint integration has no musl build and fails the install outright. The
# runtime stage below is Alpine, because nothing installs there.
FROM oven/bun:1.4.2-debian AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
# Every workspace package this image's build reaches, and no more.
# `tooling/test/docker.test.ts` computes the set and fails with the lines
# to paste, so this block is generated rather than remembered.
COPY apps/marketing/package.json apps/marketing/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/emails/package.json packages/emails/
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
RUN bunx tsc -b apps/marketing/tsconfig.json
RUN bun run --filter @vantion/marketing bundle

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5275

# `.output` is self-contained, node_modules included — Nitro's doing, the same
# as the web image.
COPY --from=build /app/apps/marketing/.output ./apps/marketing/.output

WORKDIR /app/apps/marketing
EXPOSE 5275
CMD ["bun", ".output/server/index.mjs"]
