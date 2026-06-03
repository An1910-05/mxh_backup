<?php

namespace App\Services;

use App\Repositories\ProfileRepository;
use App\Repositories\UserRepository;
use App\Repositories\PostRepository;
use App\Repositories\FollowRepository;
use App\Repositories\FriendshipRepository;
use App\Repositories\TransactionRepository;

class ProfileService
{
    private ProfileRepository $profileRepo;
    private UserRepository $userRepo;
    private PostRepository $postRepo;
    private FollowRepository $followRepo;
    private FriendshipRepository $friendRepo;
    private TransactionRepository $txRepo;

    private const VERIFIED_PRICE_MONTHLY = 500000;
    private const VERIFIED_PRICE_YEARLY  = 5000000;
    private const VERIFIED_PRICE = 500000; // alias for monthly

    public function __construct()
    {
        $this->profileRepo = new ProfileRepository();
        $this->userRepo = new UserRepository();
        $this->postRepo = new PostRepository();
        $this->followRepo = new FollowRepository();
        $this->friendRepo = new FriendshipRepository();
        $this->txRepo = new TransactionRepository();
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

        $this->userRepo->expireVerifiedIfNeeded($userId);
        $user = $this->userRepo->findById($userId);

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
            'is_verified' => !empty($user['is_verified']),
            'verified_until' => $user['verified_until'] ?? null,
            'last_login_device' => $user['last_login_device'] ?? null,
            'created_at' => $user['created_at'],
        ];
    }

    public function getProfileByCustomUrl(string $url, ?int $currentUserId = null): array
    {
        $user = $this->userRepo->findByCustomUrl($url);
        if (!$user) {
            // fallback: look up by username (handles @mention links before custom_url is set)
            $user = $this->userRepo->findByUsername($url);
        }
        if (!$user) {
            throw new \RuntimeException('User not found', 404);
        }

        return $this->getProfile((int)$user['id'], $currentUserId);
    }

    public function updateProfile(int $userId, array $data): array
    {
        // Tên hiển thị (users.username) — cột UNIQUE nên check trùng trước khi đổi
        if (isset($data['username'])) {
            $name = trim($data['username']);
            if ($name !== '') {
                $existing = $this->userRepo->findByUsername($name);
                if ($existing && (int)$existing['id'] !== $userId) {
                    throw new \GraphQL\Error\Error('Tên này đã có người dùng, vui lòng chọn tên khác');
                }
                $this->userRepo->updateProfile($userId, ['username' => $name]);
            }
        }

        $profile = $this->profileRepo->findByUserId($userId);

        if (!$profile) {
            $this->profileRepo->create($userId, $data['bio'] ?? null, $data['avatar'] ?? null);
        } else {
            $this->profileRepo->update($userId, $data);
        }

        return $this->getProfile($userId, $userId);
    }

    public function purchaseVerified(int $userId, string $duration = 'monthly'): array
    {
        $isYearly = $duration === 'yearly';
        $price    = $isYearly ? self::VERIFIED_PRICE_YEARLY : self::VERIFIED_PRICE_MONTHLY;
        $label    = $isYearly ? 'Mua tích xanh xác thực 1 năm' : 'Mua tích xanh xác thực 1 tháng';
        $modifier = $isYearly ? '+12 months' : '+1 month';

        $this->userRepo->expireVerifiedIfNeeded($userId);
        $user    = $this->userRepo->findById($userId);
        $balance = (int)($user['balance'] ?? 0);

        if ($balance < $price) {
            $need = number_format($price, 0, ',', '.');
            throw new \RuntimeException("Số dư không đủ. Cần ít nhất {$need}đ để gia hạn.", 400);
        }

        $base = new \DateTime();
        if (!empty($user['is_verified']) && !empty($user['verified_until'])) {
            $currentUntil = new \DateTime($user['verified_until']);
            if ($currentUntil > $base) {
                $base = $currentUntil;
            }
        }
        $base->modify($modifier);
        $verifiedUntil = $base->format('Y-m-d H:i:s');

        $deducted = $this->userRepo->deductBalance($userId, $price);
        if (!$deducted) {
            throw new \RuntimeException('Không đủ số dư để gia hạn tích xanh.', 400);
        }

        $txnRef = 'VERIFIED_' . $userId . '_' . time();
        $this->txRepo->createCompleted($userId, $txnRef, $price, $label);

        $this->userRepo->setVerified($userId, $verifiedUntil);

        return $this->getProfile($userId, $userId);
    }

    public function cancelVerified(int $userId): array
    {
        $this->userRepo->cancelVerified($userId);
        return $this->getProfile($userId, $userId);
    }
}
