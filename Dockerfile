# Dockerfile: PHP 8.2 con Apache, PDO MySQL, cURL y mod_rewrite
# Réplica exacta de la arquitectura del hosting en producción (Sered / cPanel)

FROM php:8.2-apache

# Instalar dependencias del sistema y extensiones de PHP
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    curl \
    && docker-php-ext-install pdo pdo_mysql curl mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Activar módulo mod_rewrite de Apache para soporte de .htaccess
RUN a2enmod rewrite

# Configurar Apache para permitir Overrides en DocumentRoot
RUN sed -ri -e 's!/var/www/html!/var/www/html!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

# Directorio de trabajo
WORKDIR /var/www/html

EXPOSE 80
