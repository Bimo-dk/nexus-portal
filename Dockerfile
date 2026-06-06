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
#   NEXUS_INITIAL_PASSWORD   - required only when /data/portal.db is empty;
#                              seeds the initial admin user with a forced
#                              password change at first login
#
# SQLite lives at /data/portal.db — mount a named volume to persist.
# ============================================================================

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json .npmrc ./
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
ENV DATABASE_PATH=/data/portal.db

EXPOSE 80

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["node", "dist/server/index.js"]
