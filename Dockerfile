FROM node:16.14.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY ./ ./

FROM node:16.14.0-alpine AS RUN

EXPOSE 3000
# CMD ["node", "./dist/src/index.js"]
CMD npm start

