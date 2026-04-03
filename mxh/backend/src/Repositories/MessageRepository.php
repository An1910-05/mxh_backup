<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class MessageRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function getNextMsgId(int $conversationId): int
    {
        $stmt = $this->db->prepare('
            SELECT COALESCE(MAX(msg_id), 0) + 1 FROM messages WHERE conversation_id = ?
        ');
        $stmt->execute([$conversationId]);
        return (int) $stmt->fetchColumn();
    }

    public function getNextSeqNo(int $conversationId, int $senderId): int
    {
        $stmt = $this->db->prepare('
            SELECT COALESCE(MAX(seq_no), 0) + 1 FROM messages
            WHERE conversation_id = ? AND sender_id = ?
        ');
        $stmt->execute([$conversationId, $senderId]);
        return (int) $stmt->fetchColumn();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO messages (conversation_id, sender_id, msg_id, seq_no, content, content_type, media_url, media_width, media_height, reply_to_msg_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $data['conversation_id'],
            $data['sender_id'],
            $data['msg_id'],
            $data['seq_no'],
            $data['content'] ?? null,
            $data['content_type'] ?? 'text',
            $data['media_url'] ?? null,
            $data['media_width'] ?? null,
            $data['media_height'] ?? null,
            $data['reply_to_msg_id'] ?? null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT m.*, u.username,
                   (SELECT p.avatar FROM profiles p WHERE p.user_id = m.sender_id) AS sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        ');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function getMessages(int $conversationId, int $limit = 50, ?int $beforeId = null, ?int $currentUserId = null): array
    {
        $sql = '
            SELECT m.*, u.username,
                   (SELECT p.avatar FROM profiles p WHERE p.user_id = m.sender_id) AS sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ? AND m.is_deleted = 0
        ';
        $params = [$conversationId];

        if ($currentUserId) {
            $sql .= ' AND NOT EXISTS (SELECT 1 FROM message_hidden mh WHERE mh.message_id = m.id AND mh.user_id = ?)';
            $params[] = $currentUserId;
        }

        if ($beforeId) {
            $sql .= ' AND m.id < ?';
            $params[] = $beforeId;
        }

        $sql .= ' ORDER BY m.id DESC LIMIT ?';
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_reverse($rows);
    }

    public function editMessage(int $id, string $content): bool
    {
        $stmt = $this->db->prepare('
            UPDATE messages SET content = ?, is_edited = 1, edited_at = NOW()
            WHERE id = ?
        ');
        return $stmt->execute([$content, $id]);
    }

    public function softDelete(int $id): bool
    {
        $stmt = $this->db->prepare('
            UPDATE messages SET is_deleted = 1, content = NULL, media_url = NULL
            WHERE id = ?
        ');
        return $stmt->execute([$id]);
    }

    /** Xóa toàn bộ tin nhắn trong hội thoại (cả hai bên không còn nội dung). */
    public function softDeleteAllInConversation(int $conversationId): int
    {
        $stmt = $this->db->prepare('
            UPDATE messages
            SET is_deleted = 1, content = NULL, media_url = NULL, is_unsent = 0
            WHERE conversation_id = ? AND is_deleted = 0
        ');
        $stmt->execute([$conversationId]);
        return $stmt->rowCount();
    }

    public function unsend(int $id): bool
    {
        $stmt = $this->db->prepare('
            UPDATE messages SET is_unsent = 1, content = NULL, media_url = NULL
            WHERE id = ?
        ');
        return $stmt->execute([$id]);
    }

    public function hideForUser(int $messageId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            INSERT IGNORE INTO message_hidden (message_id, user_id) VALUES (?, ?)
        ');
        return $stmt->execute([$messageId, $userId]);
    }

    /** Ẩn mọi tin chưa xóa trong hội thoại phía user (giống bấm ẩn từng tin, một lần). */
    public function hideAllVisibleForUserInConversation(int $conversationId, int $userId): int
    {
        $stmt = $this->db->prepare('
            INSERT IGNORE INTO message_hidden (message_id, user_id)
            SELECT m.id, ? FROM messages m
            WHERE m.conversation_id = ? AND m.is_deleted = 0
        ');
        $stmt->execute([$userId, $conversationId]);
        return $stmt->rowCount();
    }

    public function isHiddenForUser(int $messageId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            SELECT 1 FROM message_hidden WHERE message_id = ? AND user_id = ?
        ');
        $stmt->execute([$messageId, $userId]);
        return (bool) $stmt->fetchColumn();
    }

    public function searchInConversation(int $conversationId, string $query, int $limit = 20): array
    {
        $stmt = $this->db->prepare('
            SELECT m.*, u.username,
                   (SELECT p.avatar FROM profiles p WHERE p.user_id = m.sender_id) AS sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ? AND m.is_deleted = 0 AND m.content LIKE ?
            ORDER BY m.id DESC
            LIMIT ?
        ');
        $stmt->execute([$conversationId, "%{$query}%", $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getUnreadCount(int $conversationId, int $userId, ?int $lastReadId): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM messages
            WHERE conversation_id = ? AND sender_id != ? AND id > COALESCE(?, 0) AND is_deleted = 0
        ');
        $stmt->execute([$conversationId, $userId, $lastReadId]);
        return (int) $stmt->fetchColumn();
    }
}
