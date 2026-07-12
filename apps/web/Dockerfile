FROM node:22-alpine

WORKDIR /app

# Copy workspace package definitions
COPY package.json ./
COPY apps/web/package.json ./apps/web/

# Install packages at monorepo root
RUN npm install --legacy-peer-deps

# Copy web app source
COPY apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev"]
