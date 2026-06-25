FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter @chess/server
# Creates a self-contained /deployment dir with prod deps + workspace packages resolved
RUN pnpm --filter @chess/server deploy --prod --legacy /deployment

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deployment .
EXPOSE 8080
CMD ["node", "dist/index.js"]
