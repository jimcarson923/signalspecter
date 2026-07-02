FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Railway injects PORT env var — expose it
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Start the app
CMD ["node", "dist/index.cjs"]
