FROM node:20-alpine

WORKDIR /app

COPY observability-service/package*.json ./
RUN npm ci --omit=dev

COPY observability-service/ ./

EXPOSE 3003

CMD ["npm", "start"]
