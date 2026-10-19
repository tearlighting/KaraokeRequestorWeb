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
RUN chmod +x /usr/local/bin/yukari-dev-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["yukari-dev-entrypoint"]
CMD ["apache2-foreground"]