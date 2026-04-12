<?php

namespace App\Services;

use App\Repositories\FollowRepository;
use App\Repositories\FriendshipRepository;
use App\Repositories\NotificationRepository;
use App\Repositories\UserRepository;

class FriendshipService
{
    private FriendshipRepository $friendRepo;
    private FollowRepository $followRepo;
    private UserRepository $userRepo;

    public function __construct()
    {
        $this->friendRepo = new FriendshipRepository();
        $this->followRepo = new FollowRepository();
        $this->userRepo = new UserRepository();
    }

    public function sendRequest(int $senderId, int $receiverId): array
    {
        if ($senderId === $receiverId) {
            throw new \RuntimeException('Cannot send friend request to yourself', 400);
        }

        $receiver = $this->userRepo->findById($receiverId);
        if (!$receiver) {
            throw new \RuntimeException('User not found', 404);
        }

        $existing = $this->friendRepo->findBetween($senderId, $receiverId);
        if ($existing) {
            if ($existing['status'] === 'accepted') {
                throw new \RuntimeException('Already friends', 409);
            }
            if ($existing['status'] === 'pending') {
                if ((int)$existing['sender_id'] === $senderId) {
                    throw new \RuntimeException('Friend request already sent', 409);
                }
                // The other person already sent us a request - auto accept
                $this->followSenderIfNeeded($senderId, $receiverId);
                $this->friendRepo->acceptRequest($existing['id']);
                (new NotificationRepository())->insert($receiverId, 'friend_accept', $senderId, null, null);
                return ['status' => 'accepted', 'message' => 'Friend request accepted (they already sent you one)', 'friendship_id' => (int)$existing['id']];
            }
            if ($existing['status'] === 'rejected') {
                $this->friendRepo->delete($existing['id']);
            }
        }

        $this->followSenderIfNeeded($senderId, $receiverId);
        $id = $this->friendRepo->sendRequest($senderId, $receiverId);
        (new NotificationRepository())->insert($receiverId, 'friend_request', $senderId, null, null);
        return ['status' => 'pending', 'message' => 'Friend request sent', 'friendship_id' => $id];
    }

    public function acceptRequest(int $userId, int $friendshipId): array
    {
        $friendship = $this->friendRepo->findById($friendshipId);
        if (!$friendship) {
            throw new \RuntimeException('Friend request not found', 404);
        }

        if ((int)$friendship['receiver_id'] !== $userId) {
            throw new \RuntimeException('Not authorized to accept this request', 403);
        }

        if ($friendship['status'] !== 'pending') {
            throw new \RuntimeException('Request is not pending', 409);
        }

        $this->friendRepo->acceptRequest($friendshipId);
        (new NotificationRepository())->insert((int)$friendship['sender_id'], 'friend_accept', $userId, null, null);
        return ['status' => 'accepted', 'message' => 'Friend request accepted'];
    }

    public function rejectRequest(int $userId, int $friendshipId): array
    {
        $friendship = $this->friendRepo->findById($friendshipId);
        if (!$friendship) {
            throw new \RuntimeException('Friend request not found', 404);
        }

        if ((int)$friendship['receiver_id'] !== $userId) {
            throw new \RuntimeException('Not authorized to reject this request', 403);
        }

        if ($friendship['status'] !== 'pending') {
            throw new \RuntimeException('Request is not pending', 409);
        }

        $this->friendRepo->rejectRequest($friendshipId);
        return ['status' => 'rejected', 'message' => 'Friend request rejected'];
    }

    public function cancelRequest(int $userId, int $friendshipId): bool
    {
        $friendship = $this->friendRepo->findById($friendshipId);
        if (!$friendship) {
            throw new \RuntimeException('Friend request not found', 404);
        }

        if ((int)$friendship['sender_id'] !== $userId) {
            throw new \RuntimeException('Not authorized to cancel this request', 403);
        }

        return $this->friendRepo->delete($friendshipId);
    }

    public function cancelRequestByUser(int $senderId, int $targetId): bool
    {
        $friendship = $this->friendRepo->findBetween($senderId, $targetId);
        if (!$friendship || $friendship['status'] !== 'pending') {
            throw new \RuntimeException('No pending request found', 404);
        }
        if ((int)$friendship['sender_id'] !== $senderId) {
            throw new \RuntimeException('Not authorized to cancel this request', 403);
        }
        return $this->friendRepo->delete($friendship['id']);
    }

    public function unfriend(int $userId, int $targetId): bool
    {
        $friendship = $this->friendRepo->findBetween($userId, $targetId);
        if (!$friendship || $friendship['status'] !== 'accepted') {
            throw new \RuntimeException('Not friends with this user', 409);
        }

        return $this->friendRepo->deleteBetween($userId, $targetId);
    }

    public function getFriends(int $userId): array
    {
        return $this->friendRepo->getFriends($userId);
    }

    public function getPendingReceived(int $userId): array
    {
        return $this->friendRepo->getPendingReceived($userId);
    }

    public function getPendingSent(int $userId): array
    {
        return $this->friendRepo->getPendingSent($userId);
    }

    public function getFriendshipInfo(int $currentUserId, int $targetUserId): array
    {
        $friendship = $this->friendRepo->findBetween($currentUserId, $targetUserId);

        if (!$friendship) {
            return ['status' => 'none', 'friendship_id' => null, 'is_sender' => false];
        }

        return [
            'status' => $friendship['status'],
            'friendship_id' => (int)$friendship['id'],
            'is_sender' => (int)$friendship['sender_id'] === $currentUserId,
        ];
    }

    public function countFriends(int $userId): int
    {
        return $this->friendRepo->countFriends($userId);
    }

    private function followSenderIfNeeded(int $senderId, int $receiverId): void
    {
        if (!$this->followRepo->isFollowing($senderId, $receiverId)) {
            $this->followRepo->create($senderId, $receiverId);
        }
    }
}
