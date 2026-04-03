<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class StoryRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function create(int $userId, string $mediaUrl, string $mediaType, ?int $mediaWidth, ?int $mediaHeight): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO stories (user_id, media_url, media_type, media_width, media_height, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
        );
        $stmt->execute([$userId, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight]);
        return (int) $this->db->lastInsertId();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT s.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = s.user_id) AS user_avatar
             FROM stories s JOIN users u ON s.user_id = u.id
             WHERE s.id = ? AND s.expires_at > NOW()'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findActiveByUserId(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT s.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = s.user_id) AS user_avatar
             FROM stories s JOIN users u ON s.user_id = u.id
             WHERE s.user_id = ? AND s.expires_at > NOW()
             ORDER BY s.created_at ASC'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    /**
     * Get stories from users the current user follows + own stories, grouped by user.
     */
    public function findFeedStories(array $userIds): array
    {
        if (empty($userIds)) return [];

        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT s.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = s.user_id) AS user_avatar
             FROM stories s JOIN users u ON s.user_id = u.id
             WHERE s.user_id IN ({$placeholders}) AND s.expires_at > NOW()
             ORDER BY s.created_at ASC"
        );
        $stmt->execute($userIds);
        return $stmt->fetchAll();
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM stories WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function deleteExpired(): int
    {
        $stmt = $this->db->prepare('DELETE FROM stories WHERE expires_at <= NOW()');
        $stmt->execute();
        return $stmt->rowCount();
    }
}
