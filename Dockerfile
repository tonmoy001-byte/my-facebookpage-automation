FROM node:20-alpine

WORKDIR /app

# Copy worker files
COPY worker/package.json ./
COPY worker/prisma ./prisma/
COPY worker/prisma.config.ts ./

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy worker source
COPY worker/src ./src/

# Run the worker
CMD ["node", "src/index.js"]
