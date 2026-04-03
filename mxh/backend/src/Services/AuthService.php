<?php

namespace App\Services;

use App\Repositories\UserRepository;
use App\Repositories\ProfileRepository;
use App\Helpers\JWTHelper;

class AuthService
{
    private UserRepository $userRepo;
    private ProfileRepository $profileRepo;

    public function __construct()
    {
        $this->userRepo = new UserRepository();
        $this->profileRepo = new ProfileRepository();
    }

    public function register(string $username, string $email, string $password): array
    {
        if ($this->userRepo->findByEmail($email)) {
            throw new \RuntimeException('Email already exists', 409);
        }

        if ($this->userRepo->findByUsername($username)) {
            throw new \RuntimeException('Username already exists', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $userId = $this->userRepo->create($username, $email, $passwordHash);

        $this->profileRepo->create($userId);

        $user = $this->userRepo->findById($userId);
        $token = JWTHelper::encode(['user_id' => $userId]);

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    public function login(string $email, string $password): array
    {
        $user = $this->userRepo->findByEmail($email);

        if (!$user) {
            throw new \RuntimeException('Invalid credentials', 401);
        }

        if (!password_verify($password, $user['password_hash'])) {
            throw new \RuntimeException('Invalid credentials', 401);
        }

        $token = JWTHelper::encode(['user_id' => $user['id']]);

        unset($user['password_hash']);

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    public function getCurrentUser(int $userId): ?array
    {
        return $this->userRepo->findById($userId);
    }
}
