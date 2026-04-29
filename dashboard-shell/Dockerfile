FROM node:20-alpine AS build

WORKDIR /app

COPY dashboard-shell/package*.json ./
RUN npm ci

COPY dashboard-shell/ ./
RUN npm run build

FROM nginx:1.29-alpine

COPY dashboard-shell/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/dashboard-shell/browser /usr/share/nginx/html

EXPOSE 80
