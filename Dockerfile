# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Install OpenSSL
RUN apk add --no-cache openssl

# Generate self-signed certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

COPY --from=builder /app/build /usr/share/nginx/html

# Configure nginx with SSL
RUN echo '                                   \
    server {                                \
        listen 443 ssl;                     \
        listen [::]:443 ssl;               \
        server_name _;                      \
        ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt; \
        ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key; \
        location / {                        \
            root /usr/share/nginx/html;     \
            index index.html;               \
            try_files $uri $uri/ /index.html; \
        }                                   \
    }                                       \
    server {                                \
        listen 80;                          \
        listen [::]:80;                     \
        server_name _;                      \
        return 301 https://$host$request_uri; \
    }                                       \
' > /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]