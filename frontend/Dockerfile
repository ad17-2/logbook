FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://backend:8000
COPY templates /etc/nginx/templates

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
