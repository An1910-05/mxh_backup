<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class NotificationRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function insert(int $userId, string $type, int $actorId, ?int $postId, ?int $commentId): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $type, $actorId, $postId, $commentId]);
        return (int) $this->db->lastInsertId();
    }

    public function findByUserId(int $userId, int $limit = 40, int $offset = 0): array
    {
        $stmt = $this->db->prepare(
            'SELECT n.*, u.username AS actor_username,
             (SELECT pr.avatar FROM profiles pr WHERE pr.user_id = n.actor_id) AS actor_avatar
             FROM notifications n
             JOIN users u ON u.id = n.actor_id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?'
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    public function countUnread(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public function markRead(int $notificationId, int $userId): bool
    {
        $stmt = $this->db->prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL');
        return $stmt->execute([$notificationId, $userId]);
    }

    public function markAllRead(int $userId): int
    {
        $stmt = $this->db->prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL');
        $stmt->execute([$userId]);
        return $stmt->rowCount();
    }

    public function delete(int $notificationId, int $userId): bool
    {
        $stmt = $this->db->prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');
        $stmt->execute([$notificationId, $userId]);
        return $stmt->rowCount() > 0;
    }

    public function deleteAll(int $userId): int
    {
        $stmt = $this->db->prepare('DELETE FROM notifications WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->rowCount();
    }
}
