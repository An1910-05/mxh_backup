<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class LikeRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findByPostAndUser(int $postId, int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM likes WHERE post_id = ? AND user_id = ?');
        $stmt->execute([$postId, $userId]);
        return $stmt->fetch() ?: null;
    }

    public function create(int $postId, int $userId): int
    {
        $stmt = $this->db->prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)');
        $stmt->execute([$postId, $userId]);
        return (int) $this->db->lastInsertId();
    }

    public function delete(int $postId, int $userId): bool
    {
        $stmt = $this->db->prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?');
        return $stmt->execute([$postId, $userId]);
    }

    public function countByPostId(int $postId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM likes WHERE post_id = ?');
        $stmt->execute([$postId]);
        return (int) $stmt->fetchColumn();
    }

    public function isLikedByUser(int $postId, int $userId): bool
    {
        return $this->findByPostAndUser($postId, $userId) !== null;
    }
}
