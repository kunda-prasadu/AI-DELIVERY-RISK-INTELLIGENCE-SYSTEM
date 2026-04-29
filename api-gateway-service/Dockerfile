FROM node:20-alpine

WORKDIR /app

COPY api-gateway-service/package*.json ./
RUN npm ci --omit=dev

COPY api-gateway-service/ ./

EXPOSE 3005

CMD ["npm", "start"]
