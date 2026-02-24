# ============================================
# Stage 1: Dependencies
# ============================================

FROM oven/bun:1 AS dependencies

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================

FROM oven/bun:1 AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TURBOPACK=0

RUN bunx prisma generate

RUN bun --bun next build

# ============================================
# Stage 3: Run Next.js application + Worker
# ============================================

FROM oven/bun:1 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "bunx prisma db push && bun run worker/consumer.tsx & bun --bun server.js"]
