# syntax=docker/dockerfile:1
# Node version matches mise.toml.
FROM node:24.22.1-slim AS build
WORKDIR /repo
COPY mise.toml ./
RUN npm install --global "pnpm@$(sed -n 's/^pnpm = "\(.*\)"/\1/p' mise.toml)"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY spec/package.json spec/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter backend... --filter frontend...
COPY spec spec
COPY backend backend
COPY frontend frontend
RUN pnpm --filter frontend --filter backend build \
 && pnpm --filter backend deploy --legacy --prod /app

FROM node:24.22.1-slim
ENV NODE_ENV=production PORT=3000 SPA_DIR=/app/public
WORKDIR /app
COPY --from=build /app ./
COPY --from=build /repo/frontend/dist ./public
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
