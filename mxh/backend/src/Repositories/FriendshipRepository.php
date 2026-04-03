<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class FriendshipRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM friendships WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findBetween(int $userA, int $userB): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM friendships WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)'
        );
        $stmt->execute([$userA, $userB, $userB, $userA]);
        return $stmt->fetch() ?: null;
    }

    public function sendRequest(int $senderId, int $receiverId): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO friendships (sender_id, receiver_id, status) VALUES (?, ?, "pending")'
        );
        $stmt->execute([$senderId, $receiverId]);
        return (int) $this->db->lastInsertId();
    }

    public function acceptRequest(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE friendships SET status = "accepted" WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function rejectRequest(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE friendships SET status = "rejected" WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM friendships WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function deleteBetween(int $userA, int $userB): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM friendships WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)'
        );
        return $stmt->execute([$userA, $userB, $userB, $userA]);
    }

    public function getFriendIds(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS friend_id
             FROM friendships
             WHERE (sender_id = ? OR receiver_id = ?) AND status = "accepted"'
        );
        $stmt->execute([$userId, $userId, $userId]);
        return array_column($stmt->fetchAll(), 'friend_id');
    }

    public function getFriends(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT u.id, u.username, u.email, u.custom_url, u.created_at, p.avatar
             FROM friendships f
             JOIN users u ON u.id = CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END
             LEFT JOIN profiles p ON u.id = p.user_id
             WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = "accepted"
             ORDER BY f.updated_at DESC'
        );
        $stmt->execute([$userId, $userId, $userId]);
        return $stmt->fetchAll();
    }

    public function getPendingReceived(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT f.id as friendship_id, f.sender_id, f.created_at as request_date,
                    u.id, u.username, u.custom_url, p.avatar
             FROM friendships f
             JOIN users u ON u.id = f.sender_id
             LEFT JOIN profiles p ON u.id = p.user_id
             WHERE f.receiver_id = ? AND f.status = "pending"
             ORDER BY f.created_at DESC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function getPendingSent(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT f.id as friendship_id, f.receiver_id, f.created_at as request_date,
                    u.id, u.username, u.custom_url, p.avatar
             FROM friendships f
             JOIN users u ON u.id = f.receiver_id
             LEFT JOIN profiles p ON u.id = p.user_id
             WHERE f.sender_id = ? AND f.status = "pending"
             ORDER BY f.created_at DESC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function countFriends(int $userId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM friendships WHERE (sender_id = ? OR receiver_id = ?) AND status = "accepted"'
        );
        $stmt->execute([$userId, $userId]);
        return (int) $stmt->fetchColumn();
    }

    public function getFriendshipStatus(int $userA, int $userB): ?string
    {
        $row = $this->findBetween($userA, $userB);
        if (!$row) return null;
        return $row['status'];
    }
}
