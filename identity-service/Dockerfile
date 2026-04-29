FROM node:20-alpine

WORKDIR /app

COPY identity-service/package*.json ./
RUN npm ci --omit=dev

COPY identity-service/ ./

EXPOSE 3001

CMD ["npm", "start"]
