FROM php:8.2-cli

RUN echo 'deb http://deb.debian.org/debian trixie main contrib non-free non-free-firmware' > /etc/apt/sources.list \
    && echo 'deb http://deb.debian.org/debian trixie-updates main contrib non-free non-free-firmware' >> /etc/apt/sources.list \
    && echo 'deb http://security.debian.org/debian-security trixie-security main contrib non-free non-free-firmware' >> /etc/apt/sources.list

ARG INSTALL_FFMPEG=false

RUN set -eux; \
    apt-get update || apt-get update; \
    apt-get install -y --no-install-recommends \
        unzip \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libwebp-dev \
        libfreetype6-dev; \
    if [ "$INSTALL_FFMPEG" = "true" ]; then \
        apt-get install -y --no-install-recommends ffmpeg; \
    fi; \
    docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype; \
    docker-php-ext-install -j"$(nproc)" pdo pdo_mysql zip gd exif; \
    rm -rf /var/lib/apt/lists/*

RUN echo "upload_max_filesize=1100M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size=1100M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "max_execution_time=600" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "max_input_time=600" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit=1536M" >> /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock* ./
RUN composer install --no-scripts --no-autoloader 2>/dev/null || composer install

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

COPY . .
RUN composer dump-autoload --optimize

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public", "public/router.php"]
