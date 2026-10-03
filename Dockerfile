# Multi-stage Dockerfile for Federated VCF Operations 9 Web App

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/Configuration ./Configuration

# Create directory for SQLite database storage
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["node", "dist/backend/index.js"]
