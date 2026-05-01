<?php

namespace App\Repositories;

use App\Config\Database;
use PDO;

class ConversationRepository
{
    private PDO $db;

    /** @var bool|null null = not checked yet */
    private ?bool $hasHiddenAtColumn = null;
    private ?bool $hasDissolvedAtColumn = null;

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

    /**
     * Migration 020 adds conversations.dissolved_at. Nếu chưa migrate, fallback bỏ qua filter.
     */
    public function conversationHasDissolvedAtColumn(): bool
    {
        if ($this->hasDissolvedAtColumn !== null) {
            return $this->hasDissolvedAtColumn;
        }
        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM conversations LIKE 'dissolved_at'");
            $this->hasDissolvedAtColumn = (bool) $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $this->hasDissolvedAtColumn = false;
        }
        return $this->hasDissolvedAtColumn;
    }

    public function supportsHiddenConversations(): bool
    {
        return $this->participantHasHiddenAtColumn();
    }

    public function supportsGroupDissolve(): bool
    {
        return $this->conversationHasDissolvedAtColumn();
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
        $dissolvedClause = $this->conversationHasDissolvedAtColumn()
            ? 'AND c.dissolved_at IS NULL'
            : '';
        $stmt = $this->db->prepare("
            SELECT c.*, cp.last_read_msg_id, cp.role AS my_role,
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
                (SELECT u4.username FROM messages m4b
                 JOIN users u4 ON u4.id = m4b.sender_id
                 WHERE m4b.conversation_id = c.id AND m4b.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh4b
                     WHERE mh4b.message_id = m4b.id AND mh4b.user_id = ?
                 )
                 ORDER BY m4b.id DESC LIMIT 1) AS last_message_sender_username,
                (SELECT m5.created_at FROM messages m5
                 WHERE m5.conversation_id = c.id AND m5.is_deleted = 0
                 AND NOT EXISTS (
                     SELECT 1 FROM message_hidden mh5
                     WHERE mh5.message_id = m5.id AND mh5.user_id = ?
                 )
                 ORDER BY m5.id DESC LIMIT 1) AS last_message_at
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
            WHERE 1=1 {$hiddenClause} {$dissolvedClause}
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

    // ===== Group chat helpers (Phase 1 + 2) =====

    /** Tạo group conversation, trả conversation id. Caller cần addParticipant cho creator + members. */
    public function createGroup(int $createdBy, string $title, ?string $avatar = null): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO conversations (type, title, avatar, created_by)
            VALUES ("group", ?, ?, ?)
        ');
        $stmt->execute([$title, $avatar, $createdBy]);
        return (int) $this->db->lastInsertId();
    }

    public function getMemberCount(int $conversationId): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = ?
        ');
        $stmt->execute([$conversationId]);
        return (int) $stmt->fetchColumn();
    }

    /** Số member đang online (qua user_presence). Không tính chính user gọi. */
    public function getOnlineMemberCount(int $conversationId, int $excludeUserId): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*)
            FROM conversation_participants cp
            JOIN user_presence up ON up.user_id = cp.user_id
            WHERE cp.conversation_id = ? AND cp.user_id != ? AND up.is_online = 1
        ');
        $stmt->execute([$conversationId, $excludeUserId]);
        return (int) $stmt->fetchColumn();
    }

    public function getRoleInConversation(int $conversationId, int $userId): ?string
    {
        $stmt = $this->db->prepare('
            SELECT role FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ? LIMIT 1
        ');
        $stmt->execute([$conversationId, $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? (string) $row['role'] : null;
    }

    public function countByRole(int $conversationId, string $role): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM conversation_participants
            WHERE conversation_id = ? AND role = ?
        ');
        $stmt->execute([$conversationId, $role]);
        return (int) $stmt->fetchColumn();
    }

    public function removeParticipant(int $conversationId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
        ');
        return $stmt->execute([$conversationId, $userId]);
    }

    public function setRole(int $conversationId, int $userId, string $role): bool
    {
        $stmt = $this->db->prepare('
            UPDATE conversation_participants SET role = ?
            WHERE conversation_id = ? AND user_id = ?
        ');
        return $stmt->execute([$role, $conversationId, $userId]);
    }

    /** Cập nhật title/avatar nhóm. Truyền null = giữ nguyên. */
    public function updateConversationInfo(int $conversationId, ?string $title, ?string $avatar): bool
    {
        $sets = [];
        $params = [];
        if ($title !== null) {
            $sets[] = 'title = ?';
            $params[] = $title;
        }
        if ($avatar !== null) {
            $sets[] = 'avatar = ?';
            $params[] = $avatar;
        }
        if (empty($sets)) return true;
        $sets[] = 'updated_at = CURRENT_TIMESTAMP';
        $params[] = $conversationId;
        $sql = 'UPDATE conversations SET ' . implode(', ', $sets) . ' WHERE id = ?';
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }

    public function setDissolvedAt(int $conversationId): bool
    {
        if (!$this->conversationHasDissolvedAtColumn()) {
            return false;
        }
        $stmt = $this->db->prepare('
            UPDATE conversations SET dissolved_at = NOW() WHERE id = ? AND dissolved_at IS NULL
        ');
        return $stmt->execute([$conversationId]);
    }

    /**
     * Trả về danh sách read state của tất cả member khác user hiện tại trong group.
     * Mỗi item: { user_id, username, avatar, role, last_read_msg_id, last_read_at }
     */
    public function getReadStatusForGroup(int $conversationId, int $excludeUserId): array
    {
        try {
            $stmt = $this->db->prepare('
                SELECT cp.user_id, cp.role, cp.last_read_msg_id, cp.last_read_at,
                       u.username, p.avatar
                FROM conversation_participants cp
                JOIN users u ON u.id = cp.user_id
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE cp.conversation_id = ? AND cp.user_id != ?
                ORDER BY cp.last_read_msg_id DESC
            ');
            $stmt->execute([$conversationId, $excludeUserId]);
        } catch (\PDOException $e) {
            $stmt = $this->db->prepare('
                SELECT cp.user_id, cp.role, cp.last_read_msg_id,
                       u.username, p.avatar
                FROM conversation_participants cp
                JOIN users u ON u.id = cp.user_id
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE cp.conversation_id = ? AND cp.user_id != ?
                ORDER BY cp.last_read_msg_id DESC
            ');
            $stmt->execute([$conversationId, $excludeUserId]);
        }
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Tìm member có role cao nhất (sau owner) để promote khi owner rời nhóm. */
    public function findNextOwnerCandidate(int $conversationId, int $excludeUserId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT cp.user_id, cp.role, cp.joined_at
            FROM conversation_participants cp
            WHERE cp.conversation_id = ? AND cp.user_id != ?
            ORDER BY FIELD(cp.role, 'admin', 'member') ASC, cp.joined_at ASC
            LIMIT 1
        ");
        $stmt->execute([$conversationId, $excludeUserId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }
}
