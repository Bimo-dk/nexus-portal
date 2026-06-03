# ============================================================================
# nexus-portal — admin UI til Bimo-Nexus registry
#
# Bygges fra repoets EGEN rod (./nexus-portal context) — pakker hentes fra
# GitHub Packages via .npmrc, ikke fra lokal nexus-packages sti.
#
# Build:
#   docker build --build-arg GITHUB_TOKEN=ghp_xxx -t nexus-portal:local .
# Run:
#   docker run --rm -p 8669:80 nexus-portal:local
# ============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

# --- Install deps (kræver GITHUB_TOKEN for @bimo-dk/nexus-core fra GH Packages) ---
ARG GITHUB_TOKEN
COPY package*.json .npmrc ./
RUN if [ -z "$GITHUB_TOKEN" ]; then echo "GITHUB_TOKEN build-arg er påkrævet (read:packages)"; exit 1; fi && \
    GITHUB_TOKEN=${GITHUB_TOKEN} npm install --no-audit --no-fund --legacy-peer-deps

# --- Build Angular ---
ARG NEXUS_TOKEN=dev-token-change-in-production
COPY tsconfig*.json angular.json federation.config.js ./
COPY src ./src
COPY public ./public

RUN node -e "const fs=require('fs'); const p='src/environments/environment.prod.ts'; let c=fs.readFileSync(p,'utf8'); c=c.replace('NEXUS_TOKEN_PLACEHOLDER', process.env.NEXUS_TOKEN || 'dev-token'); fs.writeFileSync(p,c);" \
  NEXUS_TOKEN=${NEXUS_TOKEN}

RUN npm run build:prod

# ============================================================================
# Nginx runtime — kun statiske filer, ingen GITHUB_TOKEN
# ============================================================================
FROM nginx:alpine
RUN apk add --no-cache wget

COPY --from=builder /app/dist/manager/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
