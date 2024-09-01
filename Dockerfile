FROM node:18.20.4

WORKDIR /app

ADD package.json /app/package.json
ADD package-lock.json /app/package-lock.json

RUN npm ci

ADD . /app

CMD npm start
