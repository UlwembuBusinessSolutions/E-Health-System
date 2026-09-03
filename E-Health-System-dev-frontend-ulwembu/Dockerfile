# Dev-mode image only — runs the Vite dev server with hot reload, not a
# production build. docker-compose.yml (in Backend/) bind-mounts this
# directory over /app at runtime, so the COPY below only matters for the
# image's own layer cache / a build with no bind mount at all.
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
# --host binds 0.0.0.0 instead of Vite's default localhost — without it,
# the dev server is unreachable from outside the container even with the
# port published.
CMD ["npm", "run", "dev", "--", "--host"]
