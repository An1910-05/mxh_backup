<?php

namespace App\Middleware;

class CorsMiddleware
{
    public static function handle(): void
    {
        $frontendUrl = $_ENV['FRONTEND_URL'] ?? '*';

        header("Access-Control-Allow-Origin: {$frontendUrl}");
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
