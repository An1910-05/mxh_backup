<?php

namespace App\Services;

use App\Repositories\ProfileRepository;
use App\Repositories\UserRepository;
use App\Repositories\PostRepository;
use App\Repositories\FollowRepository;
use App\Repositories\FriendshipRepository;

class ProfileService
{
    private ProfileRepository $profileRepo;
    private UserRepository $userRepo;
    private PostRepository $postRepo;
    private FollowRepository $followRepo;
    private FriendshipRepository $friendRepo;

    public function __construct()
    {
        $this->profileRepo = new ProfileRepository();
        $this->userRepo = new UserRepository();
        $this->postRepo = new PostRepository();
        $this->followRepo = new FollowRepository();
        $this->friendRepo = new FriendshipRepository();
    }

    public function getProfile(int $userId, ?int $currentUserId = null): array
    {
        $user = $this->userRepo->findById($userId);
        if (!$user) {
            throw new \RuntimeException('User not found', 404);
        }

        $profile = $this->profileRepo->findByUserId($userId);

        $friendInfo = ['status' => 'none', 'friendship_id' => null, 'is_sender' => false];
        if ($currentUserId && $currentUserId !== $userId) {
            $friendship = $this->friendRepo->findBetween($currentUserId, $userId);
            if ($friendship) {
                $friendInfo = [
                    'status' => $friendship['status'],
                    'friendship_id' => (int)$friendship['id'],
                    'is_sender' => (int)$friendship['sender_id'] === $currentUserId,
                ];
            }
        }

        return [
            'user_id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'custom_url' => $user['custom_url'] ?? null,
            'bio' => $profile['bio'] ?? null,
            'avatar' => $profile['avatar'] ?? null,
            'cover_photo' => $profile['cover_photo'] ?? null,
            'post_count' => $this->postRepo->countByUserId($userId),
            'follower_count' => $this->followRepo->countFollowers($userId),
            'following_count' => $this->followRepo->countFollowing($userId),
            'friend_count' => $this->friendRepo->countFriends($userId),
            'is_following' => $currentUserId ? $this->followRepo->isFollowing($currentUserId, $userId) : false,
            'friendship_status' => $friendInfo['status'],
            'friendship_id' => $friendInfo['friendship_id'],
            'friendship_is_sender' => $friendInfo['is_sender'],
            'created_at' => $user['created_at'],
        ];
    }

    public function getProfileByCustomUrl(string $url, ?int $currentUserId = null): array
    {
        $user = $this->userRepo->findByCustomUrl($url);
        if (!$user) {
            throw new \RuntimeException('User not found', 404);
        }

        return $this->getProfile((int)$user['id'], $currentUserId);
    }

    public function updateProfile(int $userId, array $data): array
    {
        $profile = $this->profileRepo->findByUserId($userId);

        if (!$profile) {
            $this->profileRepo->create($userId, $data['bio'] ?? null, $data['avatar'] ?? null);
        } else {
            $this->profileRepo->update($userId, $data);
        }

        return $this->getProfile($userId, $userId);
    }
}
