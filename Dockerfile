# syntax=docker/dockerfile:1.7
# ============================================================================
# nexus-portal — admin UI + BFF for the Bimo-Nexus registry.
#
# The container serves two things:
#   - the Angular bundle at /
#   - the Node/Fastify backend at /api/* and /api/ws
#
# Required env-vars at runtime:
#   SESSION_SECRET           - cookie signing secret (strong random)
#   NEXUS_TOKEN              - registry token, server-side only
#   NEXUS_INITIAL_PASSWORD   - required only when the users table is empty;
#                              seeds the initial admin user with a forced
#                              password change at first login
#
# Database (DATABASE_URL):
#   SQLite (default): sqlite:/data/portal.db — mount a named volume to persist.
#   PostgreSQL:       postgres://user:pass@host:5432/dbname
#   MySQL / MariaDB:  mysql://user:pass@host:3306/dbname
# ============================================================================

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json .npmrc ./
# @bimo-dk/* packages are public on npmjs.com — no auth needed. No BuildKit
# secret mount, no .npmrc override beyond legacy-peer-deps.
RUN npm install --no-audit --no-fund --legacy-peer-deps

FROM deps AS client-build
COPY tsconfig*.json angular.json federation.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build:client

FROM deps AS server-build
COPY tsconfig*.json ./
COPY server ./server
RUN npm run build:server

FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json .npmrc ./
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache wget

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=server-build /app/dist/server ./dist/server
COPY --from=client-build /app/dist/manager/browser ./dist/manager/browser
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=80
ENV HOST=0.0.0.0
ENV STATIC_DIR=/app/dist/manager/browser
ENV DATABASE_URL=sqlite:/data/portal.db

EXPOSE 80

# Operators picking Postgres/MySQL get no value from a /data volume —
# mount it explicitly with `-v <vol>:/data` only when DATABASE_URL is
# the default sqlite path. Leaving the VOLUME directive in the image
# silently created anonymous volumes and confused users. (G-4)

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["node", "dist/server/index.js"]
