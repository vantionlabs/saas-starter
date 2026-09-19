# The brand kit is files. Serving them needs a web server, not a runtime.
#
# Two stages: Node builds and prerenders, nginx serves. The image that ships
# carries no JavaScript toolchain at all, which is the difference between a
# 20MB image and a 200MB one for a page that never executes on the server.
FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY apps/brand/package.json apps/brand/
COPY packages/ui/package.json packages/ui/
COPY packages/tokens/package.json packages/tokens/
COPY packages/modules/iam/package.json packages/modules/iam/
COPY packages/database/package.json packages/database/
COPY packages/modules/contact/package.json packages/modules/contact/
COPY packages/modules/billing/package.json packages/modules/billing/
COPY packages/modules/files/package.json packages/modules/files/
COPY packages/modules/assistant/package.json packages/modules/assistant/
COPY packages/modules/agent/package.json packages/modules/agent/
COPY packages/modules/jobs/package.json packages/modules/jobs/
COPY packages/modules/webhooks/package.json packages/modules/webhooks/
COPY packages/modules/notifications/package.json packages/modules/notifications/
COPY packages/emails/package.json packages/emails/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @vantion/brand build

FROM nginx:alpine

COPY --from=build /app/apps/brand/dist /usr/share/nginx/html
