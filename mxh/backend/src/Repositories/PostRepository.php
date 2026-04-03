<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class PostRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT p.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findAll(int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT p.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$limit, $offset]);
        return $stmt->fetchAll();
    }

    public function findByUserId(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT p.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function findByUserIds(array $userIds, int $limit = 20, int $offset = 0): array
    {
        if (empty($userIds)) return [];
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $sql = "SELECT p.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = p.user_id) AS user_avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.user_id IN ({$placeholders}) ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([...$userIds, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function create(int $userId, string $content, ?string $mediaUrl = null, ?string $mediaType = null, ?int $mediaWidth = null, ?int $mediaHeight = null, ?string $locationLabel = null, ?float $latitude = null, ?float $longitude = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO posts (user_id, content, media_url, media_type, media_width, media_height, location_label, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight, $locationLabel, $latitude, $longitude]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, string $content): bool
    {
        $stmt = $this->db->prepare('UPDATE posts SET content = ? WHERE id = ?');
        return $stmt->execute([$content, $id]);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM posts WHERE id = ?');
        return $stmt->execute([$id]);
    }

    public function countByUserId(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM posts WHERE user_id = ?');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }
}
