<?php

namespace App\Helpers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JWTHelper
{
    public static function encode(array $payload): string
    {
        $payload['iat'] = time();
        $payload['exp'] = time() + (int)$_ENV['JWT_EXPIRY'];

        return JWT::encode($payload, $_ENV['JWT_SECRET'], 'HS256');
    }

    public static function decode(string $token): ?object
    {
        try {
            return JWT::decode($token, new Key($_ENV['JWT_SECRET'], 'HS256'));
        } catch (\Exception $e) {
            return null;
        }
    }

    public static function extractFromHeader(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

        if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
