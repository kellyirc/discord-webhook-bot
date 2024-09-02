FROM node:20

WORKDIR /app

ADD package.json /app/package.json
ADD package-lock.json /app/package-lock.json

RUN npm ci

ADD . /app

CMD npm start
