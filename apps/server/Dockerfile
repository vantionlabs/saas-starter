# The Effect API.
#
# Built from the repository root, not from this directory:
#
#   docker build -f apps/server/Dockerfile -t vantion-api .
#
# That is not a quirk of this file. pnpm resolves a workspace package against
# the root lockfile and every sibling manifest, so the build context has to be
# the whole repo whatever the Dockerfile's own location. Living next to the app
# it builds is for the reader; the context is for pnpm.
#
# On a platform that builds a Dockerfile for you, point it at this path —
# Railway takes `RAILWAY_DOCKERFILE_PATH=apps/server/Dockerfile`.
#
# This image also carries the migration runner. Migrations are applied by a
# script and never at boot — two instances starting together would both migrate —
# so it is a separate command rather than an entrypoint:
#
#   docker run --rm -e DATABASE_URL=... vantion-api \
#     node packages/database/build/bundle/migrate.js

# Debian rather than Alpine: `prepare` runs `effect-tsgo patch`, whose packaged
# Oxlint integration has no musl build and fails the install outright.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Manifests first, so a source-only change does not reinstall the world.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Every workspace package this image's build reaches, and no more.
# `tooling/test/docker.test.ts` computes the set and fails with the lines
# to paste, so this block is generated rather than remembered.
COPY apps/server/package.json apps/server/
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
COPY packages/redis/package.json packages/redis/
COPY packages/telemetry/package.json packages/telemetry/
COPY packages/tokens/package.json packages/tokens/
COPY scripts/package.json scripts/
# `prepare` patches TypeScript and oxlint with the Effect language service, which
# the build needs and which pnpm runs as part of install.
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# `...` is pnpm for "and its dependencies", and it is the rule for every image
# here rather than a flourish. A workspace package resolves to `build/src/*.js`
# under its `default` condition, `.dockerignore` keeps build output out of the
# context, and a value imported from one does not resolve until something has
# built it — while every type-only import beside it is erased and does not
# notice. `tooling/test/docker.test.ts` asserts the set is complete.
# `--workspace-concurrency=1` because `tsc -b` in one package builds the
# *projects* of the packages it references, and several here reference the same
# ones: `modules/agent` and `modules/assistant` both reference
# `packages/database`. Run in parallel, two `tsc` processes write that project's
# output and `.tsbuildinfo` at once, and a third reads it half-written —
# `error TS2306: File 'src/PgTest.ts' is not a module`, on a file that is one.
#
# No package-level ordering fixes it: pnpm orders by `package.json`, and the
# duplicated work is inside tsc's own reference graph. The race was always here
# — the old filter list ran two such processes — and building the whole closure
# made it likely rather than rare. Serialising costs about a minute.
RUN pnpm --workspace-concurrency=1 --filter "@vantion/server..." build

# Alpine, not the Debian base the build used. `effect-tsgo` has no musl build so
# the install cannot run here — but nothing installs at runtime, it only runs
# node, and Alpine's rootfs is 86MB smaller.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Platforms assign a port; the server reads PORT and falls back to this.
ENV PORT=3000

# Two bundles and the .sql files, and nothing else. No node_modules: both entry
# points carry the code they actually reach, which is ~9MB out of a 250MB
# dependency tree — the rest being other entry points, type declarations, source
# maps, and CJS copies of everything.
COPY --from=build /app/apps/server/build/bundle ./apps/server/build/bundle
COPY --from=build /app/packages/database/build/bundle ./packages/database/build/bundle

EXPOSE 3000
# /health is liveness and /ready is readiness; a container check wants the former.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT??3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/build/bundle/main.js"]
