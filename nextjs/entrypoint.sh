#!/bin/sh
set -e

bunx prisma migrate resolve --applied 0_init || true
bunx prisma migrate deploy

bun run worker/consumer.tsx &
bun --bun server.js
