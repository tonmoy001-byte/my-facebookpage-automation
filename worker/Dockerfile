FROM node:20-alpine

WORKDIR /app

# Copy package files and prisma schema
COPY package.json ./
COPY prisma/ ./prisma/

# Install dependencies (postinstall runs prisma generate)
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

CMD ["node", "src/index.js"]
