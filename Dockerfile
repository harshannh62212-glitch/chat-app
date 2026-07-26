FROM node:20-alpine

RUN apk add --no-cache build-base musl-dev gcc

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN gcc -O2 dell_smm.c -o /app/dell_smm && chmod +x /app/dell_smm

EXPOSE 5000

# Run node directly to prevent npm from dropping root privileges to the 'node' user
CMD ["node", "server.js"]
