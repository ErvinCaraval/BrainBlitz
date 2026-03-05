# Frontend - Multi-stage build
# Stage 1: Build
FROM node:20 AS builder

WORKDIR /app

# Copiar todo el proyecto
COPY . .

# Instalar dependencias
RUN npm install --verbose

# Build with generic values - actual values will be injected at runtime
ENV VITE_API_URL=http://localhost:5000/api
ENV VITE_SOCKET_URL=http://localhost:5000

# Build
RUN npm run build

# Stage 2: Runtime
FROM nginx:alpine

LABEL maintainer="Ervin Caraval <ervin@brainblitz.com>"
LABEL version="1.0"
LABEL description="Frontend React para BrainBlitz"

# Instalar curl y bash para health check y scripts
RUN apk add --no-cache curl bash

# Copiar configuración de Nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./nginx-default.conf /etc/nginx/conf.d/default.conf

# Copiar el dist del builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar entrypoint script
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Crear archivo env-config.js vacío que será generado en tiempo de ejecución
RUN touch /usr/share/nginx/html/env-config.js

# Permisos
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx

# Usuario nginx
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Puerto
EXPOSE 80

# Inicio con script que genera configuración en tiempo de ejecución
ENTRYPOINT ["/entrypoint.sh"]
