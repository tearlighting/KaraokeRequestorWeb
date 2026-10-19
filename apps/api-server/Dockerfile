FROM node:24-alpine AS build
WORKDIR /workspace/apps/api-server
COPY apps/api-server/package*.json ./
RUN npm ci
COPY apps/api-server/tsconfig.json ./
COPY apps/api-server/src ./src
COPY packages/contracts /workspace/packages/contracts
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY apps/api-server/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /workspace/apps/api-server/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
