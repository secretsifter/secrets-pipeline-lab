# syntax=docker/dockerfile:1
# Multi-stage build for the InsecureShield pipeline lab.
# No secret literals live in this file: the secret arrives as a build-arg
# (DOTENV, sourced from CI secrets) and travels two paths:
#   build stage   → inlined into the compiled bundle            (path P4)
#   runtime stage → materialized into an image layer, served    (path P5 → P7)

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG DOTENV
RUN printf '%s\n' "$DOTENV" > .env && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3200
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY data ./data
COPY public ./public
COPY --from=build /app/dist ./dist
# Runtime secrets baked into the image filesystem (path P5): discoverable by
# anyone who pulls the image, but invisible to a source/history scan.
ARG DOTENV
RUN printf '%s\n' "$DOTENV" > .env
EXPOSE 3200
CMD ["node", "server.js"]
