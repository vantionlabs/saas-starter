# The TanStack Start web server.
#
# Built from the repository root, not from this directory:
#
#   docker build -f apps/web/Dockerfile -t vantion-web .
#
# That is not a quirk of this file. A workspace package resolves against the
# root lockfile and every sibling manifest, so the build context has to be the
# whole repo whatever the Dockerfile's own location.
#
# On a platform that builds a Dockerfile for you, point it at this path —
# Railway takes `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`.
#
# This serves SSR and its own static assets. Behind a CDN the asset requests
# should never reach it, but a boilerplate that only works behind one is not
# much of a boilerplate.
#
# It proxies nothing: the browser talks to the API directly, so the two need a
# shared parent domain for the session cookie. See AGENTS.md.

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
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
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
# The API's address as the browser sees it, baked into the client bundle — Vite
# substitutes `VITE_` values at build time, so this is a build argument and not
# a runtime variable. It must be the API's *public* address: a browser resolves
# it, not this container.
ARG VITE_AUTH_BASE_URL=http://localhost:3000
ENV VITE_AUTH_BASE_URL=$VITE_AUTH_BASE_URL
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
RUN bunx tsc -b apps/web/tsconfig.json
RUN bun run --filter @vantion/web bundle

# Alpine for the same reason as the API image: nothing installs here, and the
# rootfs is 86MB smaller than the Debian base the build needed.
FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173

# Nitro turns the Start fetch handler into a server, so there is nothing to host
# it with by hand: `.output` is self-contained, node_modules included.
COPY --from=build /app/apps/web/.output ./apps/web/.output

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["bun", ".output/server/index.mjs"]
