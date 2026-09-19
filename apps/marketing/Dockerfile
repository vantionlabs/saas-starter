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
# Oxlint integration has no musl build and fails the install outright.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/marketing/package.json apps/marketing/
COPY packages/ui/package.json packages/ui/
COPY packages/tokens/package.json packages/tokens/
COPY packages/modules/iam/package.json packages/modules/iam/
COPY packages/database/package.json packages/database/
COPY scripts/package.json scripts/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @vantion/marketing build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5275

# `.output` is self-contained, node_modules included — Nitro's doing, the same
# as the web image.
COPY --from=build /app/apps/marketing/.output ./apps/marketing/.output

WORKDIR /app/apps/marketing
EXPOSE 5275
CMD ["node", ".output/server/index.mjs"]
