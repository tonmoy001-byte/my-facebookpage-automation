FROM node:20-alpine

WORKDIR /app

# Copy worker files
COPY worker/package.json ./
COPY worker/prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy worker source
COPY worker/src ./src/

# Run the worker
CMD ["node", "src/index.js"]
