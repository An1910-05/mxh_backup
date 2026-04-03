<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class FollowRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function isFollowing(int $followerId, int $followingId): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?');
        $stmt->execute([$followerId, $followingId]);
        return (bool) $stmt->fetch();
    }

    public function create(int $followerId, int $followingId): int
    {
        $stmt = $this->db->prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)');
        $stmt->execute([$followerId, $followingId]);
        return (int) $this->db->lastInsertId();
    }

    public function delete(int $followerId, int $followingId): bool
    {
        $stmt = $this->db->prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?');
        return $stmt->execute([$followerId, $followingId]);
    }

    public function getFollowingIds(int $userId): array
    {
        $stmt = $this->db->prepare('SELECT following_id FROM follows WHERE follower_id = ?');
        $stmt->execute([$userId]);
        return array_column($stmt->fetchAll(), 'following_id');
    }

    public function getFollowerIds(int $userId): array
    {
        $stmt = $this->db->prepare('SELECT follower_id FROM follows WHERE following_id = ?');
        $stmt->execute([$userId]);
        return array_column($stmt->fetchAll(), 'follower_id');
    }

    public function countFollowing(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM follows WHERE follower_id = ?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public function countFollowers(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM follows WHERE following_id = ?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public function getFollowers(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT u.id, u.username, u.email, u.custom_url, u.created_at, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = u.id) AS avatar
             FROM follows f
             JOIN users u ON u.id = f.follower_id
             WHERE f.following_id = ?
             ORDER BY f.created_at DESC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function getFollowing(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT u.id, u.username, u.email, u.custom_url, u.created_at, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = u.id) AS avatar
             FROM follows f
             JOIN users u ON u.id = f.following_id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }
}
