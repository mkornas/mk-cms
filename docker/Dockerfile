# One image: the API plus the built admin, served from the same origin.
# Node runs the compiled NestJS bundle; the admin is static files under
# ADMIN_DIR. Build context is the repo root.

# ── Admin (Angular) ─────────────────────────────────
FROM node:22-alpine AS admin
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @mk-cms/admin
COPY apps/admin apps/admin
RUN pnpm --filter @mk-cms/admin build

# ── API (NestJS) ────────────────────────────────────
FROM node:22-alpine AS api
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @mk-cms/api
COPY apps/api apps/api
RUN pnpm --filter @mk-cms/api build \
  && pnpm --filter @mk-cms/api deploy --prod --legacy /out

# ── Runtime ─────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4000
ENV ADMIN_DIR=/app/admin
ENV MEDIA_LOCAL_DIR=/data/media
RUN apk add --no-cache tini && mkdir -p /data/media && chown -R node:node /data
USER node
COPY --from=api --chown=node:node /out /app
COPY --from=admin --chown=node:node /app/apps/admin/dist/admin/browser /app/admin
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
