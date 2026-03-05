FROM redis:6-alpine

# Default Redis config is fine for local dev; copy a custom config if provided
COPY redis.conf /usr/local/etc/redis/redis.conf

CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
