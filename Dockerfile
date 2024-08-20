# Use the official Node.js image from the Docker Hub
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Download and install the C2PA tool
RUN apk add --no-cache curl && \
    curl -L https://github.com/contentauth/c2patool/releases/latest/download/c2patool-linux-amd64 -o c2patool && \
    chmod +x c2patool && \
    mv c2patool /usr/local/bin/

# Expose the port your app runs on
EXPOSE 3000

# Command to run your application
CMD ["node", "server.js"]