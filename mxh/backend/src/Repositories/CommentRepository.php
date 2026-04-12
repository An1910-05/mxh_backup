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
        $stmt = $this->db->prepare('INSERT INTO comments (post_id, parent_id, user_id, content, media_url, media_type, media_width, media_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$postId, $parentId, $userId, $content, $mediaUrl, $mediaType, $mediaWidth, $mediaHeight]);
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

    /**
     * Batch: đếm comment cho nhiều post cùng lúc.
     * Trả về [post_id => count].
     */
    public function countByPostIds(array $postIds): array
    {
        if (empty($postIds)) return [];
        $placeholders = implode(',', array_fill(0, count($postIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT post_id, COUNT(*) AS cnt FROM comments WHERE post_id IN ($placeholders) GROUP BY post_id"
        );
        $stmt->execute($postIds);
        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(int)$row['post_id']] = (int)$row['cnt'];
        }
        return $result;
    }

    public function delete(int $id): bool
    {
        // Also delete replies whose parent_id references this comment
        $stmt = $this->db->prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?');
        return $stmt->execute([$id, $id]);
    }
}
