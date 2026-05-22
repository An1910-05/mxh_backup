<?php

namespace App\Middleware;

use App\Helpers\JWTHelper;
use App\Helpers\Response;
use App\Repositories\UserRepository;


class AuthMiddleware
{
    /**
     * Require authentication. Halts with 401 if no valid token.
     */
    public static function authenticate(): array
    {
        $token = JWTHelper::extractFromHeader();

        if (!$token) {
            Response::error('Unauthorized: No token provided', 401);
        }

        $decoded = JWTHelper::decode($token);

        if (!$decoded || !isset($decoded->user_id)) {
            Response::error('Unauthorized: Invalid token', 401);
        }

        $userRepo = new UserRepository();
        $user = $userRepo->findById($decoded->user_id);

        if (!$user) {
            Response::error('Unauthorized: User not found', 401);
        }

        if (!empty($user['is_blocked'])) {
            Response::error('account_banned', 403);
        }

        return $user;
    }

    /**
     * Optional auth - returns user if token valid, null otherwise. Does not halt.
     * Returns null for blocked users so they are treated as anonymous.
     */
    public static function optionalAuth(): ?array
    {
        $token = JWTHelper::extractFromHeader();

        if (!$token) {
            return null;
        }

        $decoded = JWTHelper::decode($token);

        if (!$decoded || !isset($decoded->user_id)) {
            return null;
        }

        $userRepo = new UserRepository();
        $user = $userRepo->findById($decoded->user_id);

        if (!$user || !empty($user['is_blocked'])) {
            return null;
        }

        return $user;
    }
}
