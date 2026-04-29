FROM node:20-alpine

WORKDIR /app

COPY project-service/package*.json ./
RUN npm ci --omit=dev

COPY project-service/ ./

EXPOSE 3002

CMD ["npm", "start"]
