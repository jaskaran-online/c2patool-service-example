# Use an official Node.js runtime as the base image
FROM ubuntu:22.04

# Set environment variable to allow prompts without interaction
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, curl, and other dependencies required for C2PA tool
RUN apt-get update && apt-get install -y \
    curl \
    tar \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Rust and Cargo
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Add Cargo to the PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Install cargo-binstall and c2patool
RUN cargo install cargo-binstall \
    && cargo binstall c2patool -y

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port on which your API or web app will run (adjust as needed)
EXPOSE 3000

# Define the command to start your application
CMD ["node", "server.js"]