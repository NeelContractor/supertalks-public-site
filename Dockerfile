FROM oven/bun:1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source.
COPY . .

ENV NODE_ENV=production
EXPOSE 3002

CMD ["bun", "src/index.ts"]