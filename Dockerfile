# Use the official lightweight Node.js 12 image.
# https://hub.docker.com/_/node
FROM alpine:3.14

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

RUN apk --no-cache upgrade && apk add --no-cache npm && apk add --no-cache chromium

# Install production dependencies.
RUN npm install --only=production

# Copy local code to the container image.
COPY . ./

#RUN apt-get update
#RUN apt-get install -y apt-utils
#RUN apt-get install -y chromium

#RUN apk --no-cache upgrade && apk add --no-cache chromium

ENV CHROME_BIN=/usr/bin/chromium-browser

# Run the web service on container startup.
CMD [ "npm", "start" ]
