# Node is pinned so the matrix is reproducible run to run; any Node 20+ shows
# the same thing. The variable that matters is JSDOM_VERSION.
FROM node:24.13.0-alpine
WORKDIR /repro

ARG JSDOM_VERSION=28.1.0
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm install --no-audit --no-fund jsdom@${JSDOM_VERSION}

COPY lib ./lib
COPY *.mjs retainers.py ./

ENTRYPOINT ["node", "--expose-gc"]
CMD ["01-minimal.mjs"]
