#!/bin/sh
set -e
# Chờ TCP tới MySQL (không phụ thuộc file .php trên volume — tránh lỗi khi mount thiếu thư mục)
php <<'EOPHP'
<?php
$host = getenv('DB_HOST') ?: 'mysql';
$port = (int)(getenv('DB_PORT') ?: 3306);
$maxSeconds = (int)(getenv('DB_WAIT_TIMEOUT') ?: 120);
$stderr = fopen('php://stderr', 'w');
for ($i = 0; $i < $maxSeconds; $i++) {
    $fp = @fsockopen($host, $port, $errno, $errstr, 1.0);
    if ($fp) {
        fclose($fp);
        exit(0);
    }
    if ($i === 0) {
        fwrite($stderr, "Waiting for MySQL at {$host}:{$port} (timeout {$maxSeconds}s)...\n");
    }
    sleep(1);
}
fwrite($stderr, "Timeout: could not reach MySQL at {$host}:{$port}\n");
exit(1);
EOPHP

if [ ! -f /app/vendor/autoload.php ]; then
  composer install --no-interaction
fi
exec "$@"
