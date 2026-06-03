# syntax=docker/dockerfile:1.7
# ============================================================================
# nexus-portal — admin UI til Bimo-Nexus registry
#
# Config-strategi: RUNTIME (ikke build-time). Image bygges én gang, samme
# image kører med forskellige NEXUS_TOKEN env-vars uden rebuild:
#
#   docker run -p 8669:80 \
#     -e NEXUS_TOKEN=<din-token> \
#     ghcr.io/bimo-dk/nexus-portal:latest
#
# nginx-entrypoint kører /docker-entrypoint.d/40-runtime-config.sh ved start →
# genererer /assets/config.json fra env-vars → Angular henter det før bootstrap.
# ============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json .npmrc ./

RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) \
    npm install --no-audit --no-fund --legacy-peer-deps

COPY tsconfig*.json angular.json federation.config.js ./
COPY src ./src
COPY public ./public

RUN npm run build:prod

# ============================================================================
# Nginx runtime — runtime-config substitution før nginx starter
# ============================================================================
FROM nginx:alpine
RUN apk add --no-cache wget gettext

COPY --from=builder /app/dist/manager/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint-script der substituerer env-vars ind i /assets/config.json
COPY docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
