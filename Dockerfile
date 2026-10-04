FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Just the Prisma CLI and the migrations, so the container can migrate the
# database on start without shipping the whole node_modules.
# Keep the prisma version in sync with package.json.
FROM node:22-alpine AS migrator
WORKDIR /migrate
RUN npm init -y > /dev/null && npm install prisma@7.10.0 dotenv
COPY prisma7.config.ts ./
COPY prisma ./prisma

FROM node:22-alpine AS runner
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/imanirumvaolivier20-a11y/piramid"
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads \
    APP_VERSION=$APP_VERSION
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=migrator --chown=node:node /migrate /migrate
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "cd /migrate && npx prisma migrate deploy && cd /app && exec node server.js"]
