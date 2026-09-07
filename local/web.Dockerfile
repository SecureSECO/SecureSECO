FROM node:24 AS portal
WORKDIR /portal
COPY components/portal/package*.json ./
RUN npm ci
COPY components/portal/ ./
ENV VITE_HOST=localhost:3001 VITE_PROTOCOL=http
RUN npm run build
FROM node:24
WORKDIR /usr/app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
COPY --from=portal /portal/dist ./public
RUN npx tsc
CMD ["node", "dist/app.js"]
