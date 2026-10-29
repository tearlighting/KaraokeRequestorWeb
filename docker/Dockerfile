FROM node:24-alpine AS user-web-build
WORKDIR /repo
COPY apps/user-web/package.json apps/user-web/package-lock.json ./apps/user-web/
RUN npm --prefix apps/user-web ci
COPY packages/contracts ./packages/contracts
COPY packages/web-foundation ./packages/web-foundation
COPY packages/theme ./packages/theme
COPY packages/language ./packages/language
COPY packages/reactiveStore ./packages/reactiveStore
COPY packages/test-support ./packages/test-support
COPY apps/user-web ./apps/user-web
RUN npm --prefix apps/user-web run build

FROM node:24-alpine AS admin-web-build
WORKDIR /repo
COPY apps/admin-web/package.json apps/admin-web/package-lock.json ./apps/admin-web/
RUN npm --prefix apps/admin-web ci
COPY packages/contracts ./packages/contracts
COPY packages/web-foundation ./packages/web-foundation
COPY packages/theme ./packages/theme
COPY packages/language ./packages/language
COPY packages/reactiveStore ./packages/reactiveStore
COPY packages/test-support ./packages/test-support
COPY apps/admin-web ./apps/admin-web
RUN npm --prefix apps/admin-web run build

FROM php:8.2-apache AS php-web

ENV TZ=Asia/Tokyo

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        gd \
        zip \
    && echo "date.timezone=${TZ}" > /usr/local/etc/php/conf.d/99-yukari-dev.ini \
    && rm -rf /var/lib/apt/lists/*

COPY docker/docker-entrypoint.sh /usr/local/bin/yukari-dev-entrypoint
COPY docker/check-php.php /usr/local/bin/yukari-check-php.php
COPY docker/portal.html /var/www/ui/index.html
COPY legacy/php /var/www/html
COPY --from=user-web-build /repo/apps/user-web/dist /var/www/ui/user
COPY --from=admin-web-build /repo/apps/admin-web/dist /var/www/ui/admin
RUN chmod +x /usr/local/bin/yukari-dev-entrypoint \
    && a2enmod proxy proxy_http headers rewrite

WORKDIR /var/www/html

ENTRYPOINT ["yukari-dev-entrypoint"]
CMD ["apache2-foreground"]

# LAN entry point intentionally serves only the built User Web and a strict
# allowlist of user API routes. It has no PHP pages, Admin assets, or MySQL port.
FROM nginx:1.27-alpine AS gateway-lan
COPY --from=user-web-build /repo/apps/user-web/dist /usr/share/nginx/html/user
COPY --from=admin-web-build /repo/apps/admin-web/dist /usr/share/nginx/html/admin
COPY gateway/nginx/lan.conf /etc/nginx/conf.d/default.conf

FROM nginx:1.27-alpine AS user-lan
COPY --from=user-web-build /repo/apps/user-web/dist /usr/share/nginx/html/user
COPY docker/user-lan.nginx.conf /etc/nginx/conf.d/default.conf

FROM nginx:1.27-alpine AS gateway-tunnel
COPY --from=user-web-build /repo/apps/user-web/dist /usr/share/nginx/html/user
COPY gateway/nginx/tunnel-user.conf /etc/nginx/conf.d/default.conf
