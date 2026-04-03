<?php

namespace App\Controllers;

use App\Services\AuthService;
use App\Validators\AuthValidator;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

class AuthController
{
    private AuthService $authService;

    public function __construct()
    {
        $this->authService = new AuthService();
    }

    public function register(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $errors = AuthValidator::validateRegister($data);
        if (!empty($errors)) {
            Response::error('Validation failed', 422, $errors);
        }

        try {
            $result = $this->authService->register(
                $data['username'],
                $data['email'],
                $data['password']
            );

            Response::success($result, 'Registration successful', 201);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function login(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $errors = AuthValidator::validateLogin($data);
        if (!empty($errors)) {
            Response::error('Validation failed', 422, $errors);
        }

        try {
            $result = $this->authService->login($data['email'], $data['password']);
            Response::success($result, 'Login successful');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function logout(): void
    {
        Response::success(null, 'Logout successful');
    }

    public function me(): void
    {
        $user = AuthMiddleware::authenticate();
        Response::success($user);
    }
}
