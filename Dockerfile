# syntax=docker/dockerfile:1.7
# ============================================================================
# nexus-portal — admin UI til Bimo-Nexus registry
# Bruger BuildKit secrets så NODE_AUTH_TOKEN IKKE leakes i build-logs.
#
# Build manuelt:
#   docker build --secret id=node_auth_token,env=NODE_AUTH_TOKEN -t nexus-portal:local .
# Run:
#   docker run --rm -p 8669:80 nexus-portal:local
# ============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json .npmrc ./

RUN --mount=type=secret,id=node_auth_token,required=true \
    NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) \
    npm install --no-audit --no-fund --legacy-peer-deps

ARG NEXUS_TOKEN=dev-token-change-in-production
COPY tsconfig*.json angular.json federation.config.js ./
COPY src ./src
COPY public ./public

RUN node -e "const fs=require('fs'); const p='src/environments/environment.prod.ts'; let c=fs.readFileSync(p,'utf8'); c=c.replace('NEXUS_TOKEN_PLACEHOLDER', process.env.NEXUS_TOKEN || 'dev-token'); fs.writeFileSync(p,c);" \
  NEXUS_TOKEN=${NEXUS_TOKEN}

RUN npm run build:prod

# ============================================================================
# Nginx runtime
# ============================================================================
FROM nginx:alpine
RUN apk add --no-cache wget

COPY --from=builder /app/dist/manager/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
