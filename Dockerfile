FROM node:alpine
LABEL org.opencontainers.image.source="https://github.com/H1ghBre4k3r/hurricane-ics"

WORKDIR /app

COPY ./build/ /app/
COPY ./node_modules /app/node_modules

COPY ./frontend/build/ /frontend/build/

ENTRYPOINT ["node", "/app/index.js"]
