FROM node:20-alpine

# Install native build tools required for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --build-from-source

COPY . .

# Cache bust — forces rebuild of app layer
ARG CACHE_BUST=1
RUN echo "Building at $CACHE_BUST" && npm run build

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
