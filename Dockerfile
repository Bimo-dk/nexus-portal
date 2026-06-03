# ============================================================================
# nexus-portal — admin UI til styring af registry
# Bygges fra projekt-rod-context.
# ============================================================================

FROM node:22-alpine AS builder

# ----- Build @bimo-nexus/core (file: dep) -----
WORKDIR /workspace/nexus-packages/packages/core
COPY nexus-packages/packages/core/package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY nexus-packages/packages/core/tsconfig.json ./
COPY nexus-packages/packages/core/tsup.config.ts ./
COPY nexus-packages/packages/core/src ./src
RUN npm run build

# ----- Build manager -----
WORKDIR /workspace/nexus-portal
COPY nexus-portal/package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

ARG NEXUS_TOKEN=dev-token-change-in-production

COPY nexus-portal/tsconfig*.json nexus-portal/angular.json nexus-portal/federation.config.js ./
COPY nexus-portal/src ./src
COPY nexus-portal/public ./public

RUN node -e "const fs=require('fs'); const p='src/environments/environment.prod.ts'; let c=fs.readFileSync(p,'utf8'); c=c.replace('NEXUS_TOKEN_PLACEHOLDER', process.env.NEXUS_TOKEN || 'dev-token'); fs.writeFileSync(p,c);" \
  NEXUS_TOKEN=${NEXUS_TOKEN}

RUN npm run build:prod

# ============================================================================
# Nginx runtime
# ============================================================================
FROM nginx:alpine
RUN apk add --no-cache wget

COPY --from=builder /workspace/nexus-portal/dist/manager/browser /usr/share/nginx/html
COPY nexus-portal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
