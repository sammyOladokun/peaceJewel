FROM node:20-alpine
WORKDIR /app
COPY apps/web ./apps/web
COPY assets ./assets
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
