<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class CommentRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findByPostId(int $postId): array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = c.user_id) AS user_avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC'
        );
        $stmt->execute([$postId]);
        return $stmt->fetchAll();
    }

    public function create(int $postId, int $userId, string $content, ?string $mediaUrl = null, ?string $mediaType = null, ?int $mediaWidth = null, ?int $mediaHeight = null, ?int $parentId = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO comments (post_id, user_id, content, media_url, media_type, media_width, media_height, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$postId, $userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight, $parentId]);
        return (int) $this->db->lastInsertId();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT c.*, u.username, (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = c.user_id) AS user_avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function countByPostId(int $postId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM comments WHERE post_id = ?');
        $stmt->execute([$postId]);
        return (int) $stmt->fetchColumn();
    }
}
