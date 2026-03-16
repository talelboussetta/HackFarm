FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
