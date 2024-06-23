FROM node:16.14.0-alpine
WORKDIR /usr/src/app
COPY . .
RUN npm install -g typescript
COPY package*.json ./

RUN npm ci

EXPOSE 3030
# CMD ["node", "./dist/src/index.js"]
CMD npm start

