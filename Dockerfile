FROM node:12-stretch

ENV TZ "Asia/Shanghai"

COPY . /app

WORKDIR /app

RUN yarn global add typescript \
&& yarn install --production \
&& tsc

CMD ["node", "index.js"]

