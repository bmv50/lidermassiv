FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .

# Build a client-safe preview. The API and admin stay available, while personal
# customer submissions and free-form AI chat are disabled in this image.
ENV VITE_DEMO_MODE=true
RUN npm run build

FROM node:22-bookworm-slim AS runtime
# Workerd uses the system CA store on Linux; Node's bundled roots alone are
# insufficient for outbound HTTPS from the worker in the slim image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && test -s /etc/ssl/certs/ca-certificates.crt
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    PUBLIC_ORIGIN=https://demo.lider-massiv.ru \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
    SITES_RUNTIME_ROOT=/data \
    WRANGLER_SEND_METRICS=false \
    CLOUDFLARE_CF_FETCH_ENABLED=false

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/app/data/products.json ./app/data/products.json
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/scripts/sites-env.mjs ./scripts/sites-env.mjs
COPY --from=build --chown=node:node /app/scripts/coolify-start.mjs ./scripts/coolify-start.mjs
COPY --from=build --chown=node:node /app/deploy/schema.sql ./deploy/schema.sql

RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
CMD ["node", "scripts/coolify-start.mjs"]
