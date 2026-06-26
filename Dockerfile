# ===== Build =====
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Gera o schema de produção (Postgres) e o client a partir dele, depois builda o Next.
RUN node scripts/gen-prod-schema.mjs \
 && npx prisma generate --schema=prisma/schema.prod.prisma \
 && npx next build

# ===== Runtime =====
FROM node:20-alpine AS run
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

# Cria/atualiza as tabelas no Postgres, popula categorias padrão (idempotente) e sobe o app.
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prod.prisma --skip-generate && (npx prisma db seed || true) && npm run start"]
