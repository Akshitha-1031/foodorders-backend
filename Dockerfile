# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Your app expects the frontend files at ../frontend. 
# If your deployment needs to serve them, ensure you adjust your build process or paths accordingly.
# Create a dummy frontend directory just to prevent errors if the directory must exist, 
# although express.static handles missing directories fine.
RUN mkdir -p ../frontend

# Expose port (Cloud providers like Render inject the PORT env variable)
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
