# The admin panel, and the only image that is ever given `ADMIN_DATABASE_URL`.
#
#   docker build -f apps/admin/Dockerfile -t vantion-admin .
#
# Built from the repository root for the same reason every other image here is:
# pnpm resolves a workspace package against the root lockfile and every sibling
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

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
COPY packages/database/package.json packages/database/
COPY packages/modules/admin/package.json packages/modules/admin/
COPY packages/modules/iam/package.json packages/modules/iam/
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
COPY packages/emails/package.json packages/emails/
COPY packages/modules/notifications/package.json packages/modules/notifications/
COPY scripts/package.json scripts/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @vantion/admin build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5174

COPY --from=build /app/apps/admin/.output ./apps/admin/.output

WORKDIR /app/apps/admin
EXPOSE 5174
CMD ["node", ".output/server/index.mjs"]
