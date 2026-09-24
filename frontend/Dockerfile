FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.30-alpine

COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://backend:8000 NGINX_RESOLVER=127.0.0.11
COPY templates /etc/nginx/templates

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
