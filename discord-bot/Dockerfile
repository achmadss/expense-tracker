FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .

CMD ["node", "index.js"]
