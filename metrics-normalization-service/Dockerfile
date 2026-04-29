FROM node:20-alpine

WORKDIR /app

COPY metrics-normalization-service/package*.json ./
RUN npm ci --omit=dev

COPY metrics-normalization-service/ ./

EXPOSE 3004

CMD ["npm", "start"]
