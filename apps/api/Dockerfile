FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY .env.example ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN DATABASE_URL=mysql://build:build@127.0.0.1:3306/aurelia npm run prisma:generate \
    && npm run build -w @aurelia/contracts \
    && npm run build -w @aurelia/api \
    && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/.env.example ./.env.example
COPY --from=build /app/apps/api/uploads ./apps/api/uploads
RUN chown -R node:node /app/apps/api/uploads

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.API_PORT||process.env.PORT||4000;fetch('http://127.0.0.1:'+p+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
