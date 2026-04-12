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

    public function createOrUpdate(int $postId, int $userId, string $reactionType = 'like'): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO likes (post_id, user_id, reaction_type) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE reaction_type = ?'
        );
        $stmt->execute([$postId, $userId, $reactionType, $reactionType]);
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

    /**
     * Batch: đếm like cho nhiều post cùng lúc.
     * Trả về [post_id => count].
     */
    public function countByPostIds(array $postIds): array
    {
        if (empty($postIds)) return [];
        $placeholders = implode(',', array_fill(0, count($postIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT post_id, COUNT(*) AS cnt FROM likes WHERE post_id IN ($placeholders) GROUP BY post_id"
        );
        $stmt->execute($postIds);
        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(int)$row['post_id']] = (int)$row['cnt'];
        }
        return $result;
    }

    /**
     * Batch: kiểm tra user đã like những post nào trong danh sách.
     * Trả về [post_id => true] (chỉ chứa post đã like).
     */
    public function likedPostsByUser(array $postIds, int $userId): array
    {
        if (empty($postIds)) return [];
        $placeholders = implode(',', array_fill(0, count($postIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT post_id FROM likes WHERE user_id = ? AND post_id IN ($placeholders)"
        );
        $stmt->execute(array_merge([$userId], $postIds));
        $result = [];
        foreach ($stmt->fetchAll() as $row) {
            $result[(int)$row['post_id']] = true;
        }
        return $result;
    }

    /**
     * Get users who reacted to a post, ordered by most recent first.
     * Returns array of [id, username, user_avatar, reaction_type].
     */
    public function getLikersByPostId(int $postId, int $limit = 50): array
    {
        $stmt = $this->db->prepare(
            'SELECT l.user_id AS id, u.username,
                    (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = l.user_id LIMIT 1) AS user_avatar,
                    l.reaction_type
             FROM likes l
             JOIN users u ON l.user_id = u.id
             WHERE l.post_id = ?
             ORDER BY l.created_at DESC
             LIMIT ?'
        );
        $stmt->execute([$postId, $limit]);
        return $stmt->fetchAll();
    }
}
