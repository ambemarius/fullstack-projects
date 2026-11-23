FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production PORT=2026
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p uploads logs && chown -R node:node /app
USER node
EXPOSE 2026
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:2026/health || exit 1
CMD ["node", "server.js"]
