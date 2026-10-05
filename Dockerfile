# Multi-stage Dockerfile for Federated VCF Operations 9 Web App
# Node 24 runs the TypeScript backend directly (type stripping) and provides node:sqlite.

# Stage 1: Build the React frontend
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/backend ./src/backend
COPY --from=builder /app/src/shared ./src/shared
COPY --from=builder /app/Configuration ./Configuration

# Create directory for SQLite database storage
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["node", "src/backend/index.ts"]
