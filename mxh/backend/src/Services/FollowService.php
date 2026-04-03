<?php

namespace App\Services;

use App\Repositories\FollowRepository;
use App\Repositories\UserRepository;

class FollowService
{
    private FollowRepository $followRepo;
    private UserRepository $userRepo;

    public function __construct()
    {
        $this->followRepo = new FollowRepository();
        $this->userRepo = new UserRepository();
    }

    public function follow(int $followerId, int $followingId): bool
    {
        if ($followerId === $followingId) {
            throw new \RuntimeException('Cannot follow yourself', 400);
        }

        $targetUser = $this->userRepo->findById($followingId);
        if (!$targetUser) {
            throw new \RuntimeException('User not found', 404);
        }

        if ($this->followRepo->isFollowing($followerId, $followingId)) {
            throw new \RuntimeException('Already following this user', 409);
        }

        $this->followRepo->create($followerId, $followingId);
        return true;
    }

    public function unfollow(int $followerId, int $followingId): bool
    {
        if ($followerId === $followingId) {
            throw new \RuntimeException('Cannot unfollow yourself', 400);
        }

        if (!$this->followRepo->isFollowing($followerId, $followingId)) {
            throw new \RuntimeException('Not following this user', 409);
        }

        return $this->followRepo->delete($followerId, $followingId);
    }

    public function isFollowing(int $followerId, int $followingId): bool
    {
        return $this->followRepo->isFollowing($followerId, $followingId);
    }

    public function getFollowingIds(int $userId): array
    {
        return $this->followRepo->getFollowingIds($userId);
    }
}
