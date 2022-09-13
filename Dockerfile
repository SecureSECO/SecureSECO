##################
# Portal
##################
ARG SECURESECO_PORTAL_IMAGE
FROM ${SECURESECO_PORTAL_IMAGE} AS portal

##################
# App
##################
FROM node:18

# Install docker
RUN apt-get -y update \
  && apt-get install --no-install-recommends -y -q \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
  && curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) \
      signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
      https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list \
    > /dev/null \
  && apt-get -y update \
  && apt-get install --no-install-recommends -y -q \
    containerd.io \
    docker-ce \
    docker-ce-cli \
    docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Copy portal files
COPY --from=portal /dist ./public

EXPOSE 3000

RUN mkdir -p dist

CMD [ "npm", "run", "start" ]
