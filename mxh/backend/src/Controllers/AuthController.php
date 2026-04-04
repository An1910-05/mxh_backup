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
                $data['password'],
                $data['birthday'] ?? null,
                $data['gender'] ?? null
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

    public function googleLogin(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['credential'])) {
            Response::error('Google credential is required', 400);
            return;
        }

        try {
            $result = $this->authService->googleLogin(
                $data['credential'],
                $data['birthday'] ?? null,
                $data['gender'] ?? null
            );
            Response::success($result, 'Login successful');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function forgotPassword(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['email'])) {
            Response::error('Email is required', 422);
            return;
        }

        try {
            $result = $this->authService->forgotPassword($data['email']);
            Response::success($result, 'OK');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function resetPassword(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['token']) || empty($data['password'])) {
            Response::error('Token và mật khẩu mới là bắt buộc', 422);
            return;
        }

        if (strlen($data['password']) < 6) {
            Response::error('Mật khẩu phải có ít nhất 6 ký tự', 422);
            return;
        }

        try {
            $result = $this->authService->resetPassword($data['token'], $data['password']);
            Response::success($result, 'OK');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function changePassword(): void
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['new_password']) || strlen($data['new_password']) < 6) {
            Response::error('Mật khẩu mới phải có ít nhất 6 ký tự', 422);
            return;
        }

        try {
            $result = $this->authService->changePassword(
                $user['id'],
                $data['current_password'] ?? null,
                $data['new_password']
            );
            Response::success($result, 'OK');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function updateProfile(): void
    {
        $user = AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $allowed = [];
        if (isset($data['birthday'])) $allowed['birthday'] = $data['birthday'];
        if (isset($data['gender'])) $allowed['gender'] = $data['gender'];
        if (isset($data['username'])) $allowed['username'] = $data['username'];

        if (empty($allowed)) {
            Response::error('Không có dữ liệu cập nhật', 422);
            return;
        }

        try {
            $result = $this->authService->updateProfile($user['id'], $allowed);
            Response::success($result, 'Profile updated');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 500);
        }
    }

    public function getSettings(): void
    {
        $user = AuthMiddleware::authenticate();

        try {
            $fullUser = $this->authService->getFullUser($user['id']);
            Response::success($fullUser);
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
