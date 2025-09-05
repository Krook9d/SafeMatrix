# Use the Node.js 22 image (alpine = léger)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend app
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start the dev server
# Always install dependencies on start to avoid stale node_modules from anonymous volumes skipping new deps
CMD ["sh", "-c", "npm install && npm run dev -- --host"]
