<?php

namespace App\Middleware;

use App\Helpers\Response;

class AdminMiddleware
{
    /**
     * Require admin role. Halts with 401/403 if not authenticated or not admin.
     */
    public static function authenticate(): array
    {
        $user = AuthMiddleware::authenticate();

        if (($user['role'] ?? 'user') !== 'admin') {
            Response::error('Forbidden: Admin access required', 403);
        }

        return $user;
    }
}
