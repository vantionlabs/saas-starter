# The brand kit is files. Serving them needs a web server, not a runtime.
#
# Two stages: Node builds and prerenders, nginx serves. The image that ships
# carries no JavaScript toolchain at all, which is the difference between a
# 20MB image and a 200MB one for a page that never executes on the server.
FROM oven/bun:1.4.2-debian AS build

WORKDIR /app

COPY package.json bun.lock ./
# Every workspace package this image's build reaches, and no more.
# `tooling/test/docker.test.ts` computes the set and fails with the lines
# to paste, so this block is generated rather than remembered.
COPY apps/brand/package.json apps/brand/
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
RUN bunx tsc -b apps/brand/tsconfig.json
RUN bun run --filter @vantion/brand bundle

FROM nginx:alpine

COPY --from=build /app/apps/brand/dist /usr/share/nginx/html
