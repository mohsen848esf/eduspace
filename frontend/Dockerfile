FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# URLs are derived from the browser origin, never baked from a developer's .env.
ENV VITE_API_URL="" VITE_WS_URL="" VITE_SENTRY_DSN=""
RUN npm run build

FROM nginx:1.28-alpine
COPY infra/server/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Deliberately outside /usr/share/nginx/html: nginx never serves this path,
# so the version isn't reachable from the public internet. Check it with
# `docker exec <container> cat /VERSION`.
ARG APP_VERSION=dev-0.0.0-local
RUN echo "$APP_VERSION" > /VERSION
EXPOSE 80
