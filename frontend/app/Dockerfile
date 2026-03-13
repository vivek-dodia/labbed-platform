FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN npm install

COPY . .

# Use empty API URL so frontend uses relative paths (works behind nginx proxy)
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
