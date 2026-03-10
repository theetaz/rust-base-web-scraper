FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# API_URL must be available at build time for Next.js rewrites
ARG API_URL=http://localhost:9000
ENV API_URL=${API_URL}

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
