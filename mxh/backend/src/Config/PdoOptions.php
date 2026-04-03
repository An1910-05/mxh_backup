<?php

namespace App\Config;

use PDO;

/**
 * Tùy chọn PDO dùng chung cho app, migrate và seed.
 * Kết nối MySQL qua Internet: đặt DB_SSL_CA (đường dẫn CA trong container) hoặc VPN/SSH tunnel (không cần SSL).
 */
class PdoOptions
{
    /**
     * @return array<int, mixed>
     */
    public static function mysqlOptions(): array
    {
        $opts = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        $ca = $_ENV['DB_SSL_CA'] ?? '';
        if ($ca !== '') {
            $opts[PDO::MYSQL_ATTR_SSL_CA] = $ca;
        }

        if (($_ENV['DB_SSL_VERIFY'] ?? '1') === '0') {
            $opts[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }

        return $opts;
    }
}
