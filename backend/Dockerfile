# Use official Node.js v18.18.2 image
FROM node:18.18.2

# Create app directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source
COPY . .

# Build the NestJS application
RUN npx @nestjs/cli build

# Expose backend port
EXPOSE 3000

# Run the application
CMD ["node", "dist/main.js"]
