# Pinned to the Node used in the environment where this was first observed.
# Any Node 20+ reproduces it; the variable that matters is JSDOM_VERSION.
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
