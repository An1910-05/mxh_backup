<?php

namespace App\Middleware;

class CorsMiddleware
{
    public static function handle(): void
    {
        $allowedOrigins = array_map('trim', explode(',', $_ENV['FRONTEND_URL'] ?? '*'));
        $requestOrigin  = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (in_array('*', $allowedOrigins, true)) {
            header('Access-Control-Allow-Origin: *');
        } elseif ($requestOrigin && in_array($requestOrigin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: {$requestOrigin}");
        } else {
            header("Access-Control-Allow-Origin: {$allowedOrigins[0]}");
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
