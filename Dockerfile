# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install Node.js dependencies (all, including dev for build)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

# Install only production Node.js dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy Python scripts to where the code expects them
COPY scripts ./scripts

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
