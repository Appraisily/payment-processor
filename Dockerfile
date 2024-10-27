# Use the official Node.js image.
FROM node:18

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install dependencies.
COPY package*.json ./
RUN npm install --production

# Copy local code to the container image.
COPY . .

# Expose the port the app runs on.
ENV PORT=8080
EXPOSE 8080

# Run the web service on container startup.
CMD [ "npm", "start" ]
