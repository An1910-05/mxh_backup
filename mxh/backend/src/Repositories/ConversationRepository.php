<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ConversationRepository
{
    private PDO $db;

    /** @var bool|null null = not checked yet */
    private ?bool $hasHiddenAtColumn = null;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Migration 010 adds hidden_at. If DB chưa migrate, tránh SQL lỗi (danh sách chat trống).
     */
    private function participantHasHiddenAtColumn(): bool
    {
        if ($this->hasHiddenAtColumn !== null) {
            return $this->hasHiddenAtColumn;
        }
        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM conversation_participants LIKE 'hidden_at'");
            $this->hasHiddenAtColumn = (bool) $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $this->hasHiddenAtColumn = false;
        }
        return $this->hasHiddenAtColumn;
    }

    public function supportsHiddenConversations(): bool
    {
        return $this->participantHasHiddenAtColumn();
    }

    public function findPrivateConversation(int $userId1, int $userId2): ?array
    {
        $stmt = $this->db->prepare('
            SELECT c.* FROM conversations c
            JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
            WHERE c.type = "private"
            LIMIT 1
        ');
        $stmt->execute([$userId1, $userId2]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function createConversation(string $type, ?int $createdBy, ?string $title = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO conversations (type, created_by, title) VALUES (?, ?, ?)');
        $stmt->execute([$type, $createdBy, $title]);
        return (int) $this->db->lastInsertId();
    }

    public function addParticipant(int $conversationId, int $userId, string $role = 'member'): void
    {
        $stmt = $this->db->prepare('
            INSERT IGNORE INTO conversation_participants (conversation_id, user_id, role)
            VALUES (?, ?, ?)
        ');
        $stmt->execute([$conversationId, $userId, $role]);
    }

    public function isParticipant(int $conversationId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ?
        ');
        $stmt->execute([$conversationId, $userId]);
        return (bool) $stmt->fetch();
    }

    public function getUserConversations(int $userId, int $limit = 50, int $offset = 0): array
    {
        $hiddenClause = $this->participantHasHiddenAtColumn()
            ? 'AND cp.hidden_at IS NULL'
            : '';
        $stmt = $this->db->prepare("
            SELECT c.*, cp.last_read_msg_id,
                (SELECT COUNT(*) FROM messages m
                 WHERE m.conversation_id = c.id
                 AND m.id > COALESCE(cp.last_read_msg_id, 0)
                 AND m.sender_id != ?
                 AND m.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh
                     WHERE mh.message_id = m.id AND mh.user_id = ?
                 )) AS unread_count,
                (SELECT m2.content FROM messages m2
                 WHERE m2.conversation_id = c.id AND m2.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh2
                     WHERE mh2.message_id = m2.id AND mh2.user_id = ?
                 )
                 ORDER BY m2.id DESC LIMIT 1) AS last_message,
                (SELECT m3.content_type FROM messages m3
                 WHERE m3.conversation_id = c.id AND m3.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh3
                     WHERE mh3.message_id = m3.id AND mh3.user_id = ?
                 )
                 ORDER BY m3.id DESC LIMIT 1) AS last_message_type,
                (SELECT m4.sender_id FROM messages m4
                 WHERE m4.conversation_id = c.id AND m4.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh4
                     WHERE mh4.message_id = m4.id AND mh4.user_id = ?
                 )
                 ORDER BY m4.id DESC LIMIT 1) AS last_message_sender_id,
                (SELECT m5.created_at FROM messages m5
                 WHERE m5.conversation_id = c.id AND m5.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh5
                     WHERE mh5.message_id = m5.id AND mh5.user_id = ?
                 )
                 ORDER BY m5.id DESC LIMIT 1) AS last_message_at
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
            WHERE 1=1 {$hiddenClause}
            ORDER BY last_message_at DESC, c.updated_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([
            $userId,
            $userId,
            $userId,
            $userId,
            $userId,
            $userId,
            $userId,
            $limit,
            $offset,
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getParticipants(int $conversationId): array
    {
        $stmt = $this->db->prepare('
            SELECT cp.*, u.username, p.avatar
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE cp.conversation_id = ?
        ');
        $stmt->execute([$conversationId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getOtherParticipant(int $conversationId, int $userId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT u.id, u.username, u.custom_url, p.avatar
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE cp.conversation_id = ? AND cp.user_id != ?
            LIMIT 1
        ');
        $stmt->execute([$conversationId, $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function updateLastRead(int $conversationId, int $userId, int $messageId): void
    {
        try {
            $stmt = $this->db->prepare('
                UPDATE conversation_participants
                SET last_read_msg_id = GREATEST(COALESCE(last_read_msg_id, 0), ?),
                    last_read_at = NOW()
                WHERE conversation_id = ? AND user_id = ?
            ');
            $stmt->execute([$messageId, $conversationId, $userId]);
        } catch (\PDOException $e) {
            $stmt = $this->db->prepare('
                UPDATE conversation_participants
                SET last_read_msg_id = GREATEST(COALESCE(last_read_msg_id, 0), ?)
                WHERE conversation_id = ? AND user_id = ?
            ');
            $stmt->execute([$messageId, $conversationId, $userId]);
        }
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM conversations WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function setHiddenAt(int $conversationId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE conversation_participants SET hidden_at = NOW()
            WHERE conversation_id = ? AND user_id = ?
        ');
        return $stmt->execute([$conversationId, $userId]);
    }

    public function clearHiddenAt(int $conversationId, int $userId): bool
    {
        if (!$this->participantHasHiddenAtColumn()) {
            return true;
        }
        $stmt = $this->db->prepare('
            UPDATE conversation_participants SET hidden_at = NULL
            WHERE conversation_id = ? AND user_id = ?
        ');
        return $stmt->execute([$conversationId, $userId]);
    }

    public function getOtherParticipantReadInfo(int $conversationId, int $currentUserId): ?array
    {
        try {
            $stmt = $this->db->prepare('
                SELECT cp.last_read_msg_id, cp.last_read_at, cp.user_id, u.username, p.avatar
                FROM conversation_participants cp
                JOIN users u ON cp.user_id = u.id
                LEFT JOIN profiles p ON u.id = p.user_id
                WHERE cp.conversation_id = ? AND cp.user_id != ?
                LIMIT 1
            ');
            $stmt->execute([$conversationId, $currentUserId]);
        } catch (\PDOException $e) {
            $stmt = $this->db->prepare('
                SELECT cp.last_read_msg_id, cp.user_id, u.username, p.avatar
                FROM conversation_participants cp
                JOIN users u ON cp.user_id = u.id
                LEFT JOIN profiles p ON u.id = p.user_id
                WHERE cp.conversation_id = ? AND cp.user_id != ?
                LIMIT 1
            ');
            $stmt->execute([$conversationId, $currentUserId]);
        }
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }
}
