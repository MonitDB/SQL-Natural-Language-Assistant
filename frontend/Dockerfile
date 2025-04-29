# Use official Node.js 18.18.2 base image
FROM node:18.18.2

# Set working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend source code
COPY . .

# Build the frontend using your build script
RUN npm run build

# Expose port for Vite preview
EXPOSE 4173

# Start the frontend preview server
CMD ["npm", "run", "start"]
