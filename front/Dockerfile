# VisualBs4Scraper frontend — production build served by nginx.
#
#   docker build -t visualbs4scraper-frontend .
#   docker run --rm -p 8080:80 visualbs4scraper-frontend
#
# Still needs the backend reachable at http://127.0.0.1:5000 from your
# browser (see ../backend/README.md) — this image only serves the static
# frontend, it doesn't proxy API calls.

# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
