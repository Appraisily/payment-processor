# Use the official Node.js image.
FROM node:18

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker caching.
COPY package*.json ./

# Install dependencies.
RUN npm install --production

# Copy the rest of the application code.
COPY . .

# Expose the port the app runs on.
ENV PORT=8080
EXPOSE 8080

# Run the web service on container startup.
CMD [ "node", "index.js" ]
