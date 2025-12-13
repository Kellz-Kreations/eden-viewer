FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

ENV NODE_ENV=production
ENV SETUP_UI_PORT=8080

CMD ["node", "server.js"]
