FROM node:24-alpine AS user-web-build
WORKDIR /repo
COPY apps/user-web/package.json apps/user-web/package-lock.json ./apps/user-web/
RUN npm --prefix apps/user-web ci
COPY packages/contracts ./packages/contracts
COPY packages/web-foundation ./packages/web-foundation
COPY packages/test-support ./packages/test-support
COPY apps/user-web ./apps/user-web
RUN npm --prefix apps/user-web run build

FROM node:24-alpine AS admin-web-build
WORKDIR /repo
COPY apps/admin-web/package.json apps/admin-web/package-lock.json ./apps/admin-web/
RUN npm --prefix apps/admin-web ci
COPY packages/contracts ./packages/contracts
COPY packages/web-foundation ./packages/web-foundation
COPY packages/test-support ./packages/test-support
COPY apps/admin-web ./apps/admin-web
RUN npm --prefix apps/admin-web run build

FROM php:8.2-apache

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
COPY docker/portal.html /var/www/ui/index.html
COPY --from=user-web-build /repo/apps/user-web/dist /var/www/ui/user
COPY --from=admin-web-build /repo/apps/admin-web/dist /var/www/ui/admin
RUN chmod +x /usr/local/bin/yukari-dev-entrypoint \
    && a2enmod proxy proxy_http headers

WORKDIR /var/www/html

ENTRYPOINT ["yukari-dev-entrypoint"]
CMD ["apache2-foreground"]
