<?php

namespace App\Services;

use App\Repositories\ConversationRepository;
use App\Repositories\MessageRepository;
use App\Config\Database;
use PDO;

/**
 * GroupChatService — toàn bộ logic quản lý nhóm chat (Phase 1 + 2).
 *
 * Phân quyền:
 *  - owner: tạo nhóm, đổi info, thêm/xoá member, phong/hạ admin, giải tán nhóm
 *  - admin: đổi info, thêm/xoá member (không xoá owner), thêm/xoá member khác
 *  - member: chỉ rời nhóm
 *
 * Mỗi action thay đổi nhóm sẽ tạo 1 system message (content_type='system')
 * để ChatService::sendMessage broadcast cho mọi participant qua WebSocket.
 *
 * KHÔNG phụ thuộc HTTP / WebSocket — controller hoặc WS handler tự gọi.
 */
class GroupChatService
{
    private ConversationRepository $convRepo;
    private MessageRepository $msgRepo;
    private ?ChatService $chatService = null;
    private PDO $db;

    public const MIN_MEMBERS_TO_CREATE = 2; // creator + ≥ 2 → tổng ≥ 3
    public const MAX_TITLE_LENGTH = 100;

    public function __construct()
    {
        $this->convRepo = new ConversationRepository();
        $this->msgRepo = new MessageRepository();
        $this->db = Database::getConnection();
    }

    private function chat(): ChatService
    {
        return $this->chatService ??= new ChatService();
    }

    /** Trả conversation đã enrich (display_name, member_count, my_role…) cho frontend hiển thị. */
    public function getEnrichedGroup(int $conversationId, int $userId): ?array
    {
        return $this->chat()->getConversationForUser($conversationId, $userId);
    }

    /**
     * Tạo nhóm mới. Creator tự động là owner, các member khác là 'member'.
     * @param int[] $memberIds Mảng user_id (KHÔNG kể creator)
     * @return array Conversation đã enrich (giống ChatService::getConversations)
     */
    public function createGroup(int $creatorId, string $title, ?string $avatar, array $memberIds): array
    {
        $title = trim($title);
        if ($title === '') {
            throw new \RuntimeException('Tên nhóm không được để trống', 400);
        }
        if (mb_strlen($title) > self::MAX_TITLE_LENGTH) {
            throw new \RuntimeException('Tên nhóm tối đa ' . self::MAX_TITLE_LENGTH . ' ký tự', 400);
        }

        $memberIds = array_values(array_unique(array_map('intval', $memberIds)));
        $memberIds = array_values(array_filter($memberIds, fn($id) => $id > 0 && $id !== $creatorId));

        if (count($memberIds) < self::MIN_MEMBERS_TO_CREATE) {
            throw new \RuntimeException('Cần chọn ít nhất ' . self::MIN_MEMBERS_TO_CREATE . ' thành viên khác bạn', 400);
        }

        $this->ensureUsersExist(array_merge([$creatorId], $memberIds));

        $this->db->beginTransaction();
        try {
            $convId = $this->convRepo->createGroup($creatorId, $title, $avatar);
            $this->convRepo->addParticipant($convId, $creatorId, 'owner');
            foreach ($memberIds as $uid) {
                $this->convRepo->addParticipant($convId, $uid, 'member');
            }

            $this->insertSystemMessage(
                $convId,
                $creatorId,
                'Đã tạo nhóm "' . $title . '"'
            );
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $this->getEnrichedGroup($convId, $creatorId) ?? $this->loadGroupOrThrow($convId, $creatorId);
    }

    /**
     * Thêm thành viên vào nhóm (admin/owner only).
     * @param int[] $memberIds
     */
    public function addMembers(int $actorId, int $conversationId, array $memberIds): array
    {
        $conv = $this->loadGroupOrThrow($conversationId, $actorId);
        $this->requireRole($conversationId, $actorId, ['owner', 'admin']);

        $memberIds = array_values(array_unique(array_map('intval', $memberIds)));
        $memberIds = array_values(array_filter($memberIds, fn($id) => $id > 0));
        if (empty($memberIds)) {
            throw new \RuntimeException('Chọn ít nhất 1 thành viên', 400);
        }
        $this->ensureUsersExist($memberIds);

        $added = [];
        foreach ($memberIds as $uid) {
            if ($this->convRepo->getRoleInConversation($conversationId, $uid) !== null) {
                continue; // đã trong nhóm
            }
            $this->convRepo->addParticipant($conversationId, $uid, 'member');
            $added[] = $uid;
        }

        if (empty($added)) {
            throw new \RuntimeException('Tất cả người được chọn đã có trong nhóm', 400);
        }

        $usernames = $this->fetchUsernames($added);
        $actorName = $this->fetchUsername($actorId);
        $names = implode(', ', array_map(fn($u) => $u['username'], $usernames));
        $this->insertSystemMessage(
            $conversationId,
            $actorId,
            $actorName . ' đã thêm ' . $names . ' vào nhóm'
        );

        return [
            'conversation_id' => $conversationId,
            'added' => $usernames,
        ];
    }

    /** Xoá member khỏi nhóm. Admin/owner only. Owner không thể tự xoá (phải dùng leaveGroup). */
    public function removeMember(int $actorId, int $conversationId, int $targetUserId): array
    {
        $this->loadGroupOrThrow($conversationId, $actorId);
        $actorRole = $this->requireRole($conversationId, $actorId, ['owner', 'admin']);

        if ($actorId === $targetUserId) {
            throw new \RuntimeException('Hãy dùng "Rời nhóm" thay vì tự xoá mình', 400);
        }

        $targetRole = $this->convRepo->getRoleInConversation($conversationId, $targetUserId);
        if ($targetRole === null) {
            throw new \RuntimeException('Người này không có trong nhóm', 404);
        }

        if ($targetRole === 'owner') {
            throw new \RuntimeException('Không thể xoá chủ nhóm', 403);
        }
        if ($actorRole === 'admin' && $targetRole === 'admin') {
            throw new \RuntimeException('Admin không thể xoá admin khác', 403);
        }

        $this->convRepo->removeParticipant($conversationId, $targetUserId);

        $actorName = $this->fetchUsername($actorId);
        $targetName = $this->fetchUsername($targetUserId);
        $this->insertSystemMessage(
            $conversationId,
            $actorId,
            $actorName . ' đã xoá ' . $targetName . ' khỏi nhóm'
        );

        return ['conversation_id' => $conversationId, 'removed_user_id' => $targetUserId];
    }

    /** Đổi tên/avatar nhóm. Admin/owner only. */
    public function updateGroupInfo(int $actorId, int $conversationId, ?string $title, ?string $avatar): array
    {
        $conv = $this->loadGroupOrThrow($conversationId, $actorId);
        $this->requireRole($conversationId, $actorId, ['owner', 'admin']);

        $newTitle = $title !== null ? trim($title) : null;
        if ($newTitle !== null) {
            if ($newTitle === '') {
                throw new \RuntimeException('Tên nhóm không được để trống', 400);
            }
            if (mb_strlen($newTitle) > self::MAX_TITLE_LENGTH) {
                throw new \RuntimeException('Tên nhóm tối đa ' . self::MAX_TITLE_LENGTH . ' ký tự', 400);
            }
        }

        $this->convRepo->updateConversationInfo($conversationId, $newTitle, $avatar);

        $actorName = $this->fetchUsername($actorId);
        $changes = [];
        if ($newTitle !== null && $newTitle !== ($conv['title'] ?? '')) {
            $changes[] = 'đổi tên nhóm thành "' . $newTitle . '"';
        }
        if ($avatar !== null && $avatar !== ($conv['avatar'] ?? null)) {
            $changes[] = 'cập nhật ảnh nhóm';
        }
        if (!empty($changes)) {
            $this->insertSystemMessage(
                $conversationId,
                $actorId,
                $actorName . ' đã ' . implode(' và ', $changes)
            );
        }

        return $this->getEnrichedGroup($conversationId, $actorId) ?? $this->loadGroupOrThrow($conversationId, $actorId);
    }

    /** User tự rời nhóm. Nếu là owner cuối cùng → tự promote member kỳ cựu nhất; nếu nhóm còn 1 mình → tự dissolve. */
    public function leaveGroup(int $actorId, int $conversationId): array
    {
        $conv = $this->loadGroupOrThrow($conversationId, $actorId);
        $role = $this->requireRole($conversationId, $actorId, ['owner', 'admin', 'member']);
        $actorName = $this->fetchUsername($actorId);

        $this->db->beginTransaction();
        try {
            if ($role === 'owner') {
                $next = $this->convRepo->findNextOwnerCandidate($conversationId, $actorId);
                if ($next) {
                    $this->convRepo->setRole($conversationId, (int)$next['user_id'], 'owner');
                    $this->convRepo->removeParticipant($conversationId, $actorId);
                    $newOwnerName = $this->fetchUsername((int)$next['user_id']);
                    $this->insertSystemMessage(
                        $conversationId,
                        $actorId,
                        $actorName . ' đã rời nhóm. ' . $newOwnerName . ' trở thành chủ nhóm mới.'
                    );
                } else {
                    $this->convRepo->removeParticipant($conversationId, $actorId);
                    $this->convRepo->setDissolvedAt($conversationId);
                }
            } else {
                $this->convRepo->removeParticipant($conversationId, $actorId);
                $this->insertSystemMessage(
                    $conversationId,
                    $actorId,
                    $actorName . ' đã rời nhóm'
                );
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return ['conversation_id' => $conversationId, 'left' => true];
    }

    /** Owner phong/hạ role thành viên. Chỉ owner mới có quyền. */
    public function changeRole(int $actorId, int $conversationId, int $targetUserId, string $newRole): array
    {
        $this->loadGroupOrThrow($conversationId, $actorId);
        $this->requireRole($conversationId, $actorId, ['owner']);

        if (!in_array($newRole, ['admin', 'member'], true)) {
            throw new \RuntimeException('Role không hợp lệ. Chỉ chấp nhận admin hoặc member', 400);
        }
        if ($actorId === $targetUserId) {
            throw new \RuntimeException('Không thể tự đổi role của bản thân. Chuyển owner trước khi rời nhóm.', 400);
        }

        $targetRole = $this->convRepo->getRoleInConversation($conversationId, $targetUserId);
        if ($targetRole === null) {
            throw new \RuntimeException('Người này không có trong nhóm', 404);
        }
        if ($targetRole === 'owner') {
            throw new \RuntimeException('Không thể đổi role của owner khác', 403);
        }
        if ($targetRole === $newRole) {
            return ['conversation_id' => $conversationId, 'unchanged' => true];
        }

        $this->convRepo->setRole($conversationId, $targetUserId, $newRole);

        $actorName = $this->fetchUsername($actorId);
        $targetName = $this->fetchUsername($targetUserId);
        $verb = $newRole === 'admin' ? 'phong' : 'gỡ vai trò admin của';
        $this->insertSystemMessage(
            $conversationId,
            $actorId,
            $actorName . ' đã ' . $verb . ' ' . $targetName
        );

        return [
            'conversation_id' => $conversationId,
            'user_id' => $targetUserId,
            'new_role' => $newRole,
        ];
    }

    /** Owner giải tán nhóm. */
    public function dissolveGroup(int $actorId, int $conversationId): array
    {
        $this->loadGroupOrThrow($conversationId, $actorId);
        $this->requireRole($conversationId, $actorId, ['owner']);

        if (!$this->convRepo->supportsGroupDissolve()) {
            throw new \RuntimeException(
                'Chạy migration database: 020_group_chat_phase1.sql (cột dissolved_at).',
                503
            );
        }

        $this->convRepo->setDissolvedAt($conversationId);

        $actorName = $this->fetchUsername($actorId);
        $this->insertSystemMessage(
            $conversationId,
            $actorId,
            $actorName . ' đã giải tán nhóm'
        );

        return ['conversation_id' => $conversationId, 'dissolved' => true];
    }

    public function getGroupMembers(int $actorId, int $conversationId): array
    {
        $this->loadGroupOrThrow($conversationId, $actorId);
        $this->requireRole($conversationId, $actorId, ['owner', 'admin', 'member']);
        return $this->convRepo->getParticipants($conversationId);
    }

    public function getGroupReadStatus(int $actorId, int $conversationId): array
    {
        $this->loadGroupOrThrow($conversationId, $actorId);
        $this->requireRole($conversationId, $actorId, ['owner', 'admin', 'member']);
        return $this->convRepo->getReadStatusForGroup($conversationId, $actorId);
    }

    // ===== Helpers =====

    private function loadGroupOrThrow(int $conversationId, int $userId): array
    {
        $conv = $this->convRepo->findById($conversationId);
        if (!$conv) {
            throw new \RuntimeException('Hội thoại không tồn tại', 404);
        }
        if ($conv['type'] !== 'group') {
            throw new \RuntimeException('Hội thoại này không phải nhóm', 400);
        }
        if (!empty($conv['dissolved_at'])) {
            throw new \RuntimeException('Nhóm đã bị giải tán', 410);
        }
        return $conv;
    }

    /** @param string[] $allowed Trả về role thực tế nếu match, throw nếu không. */
    private function requireRole(int $conversationId, int $userId, array $allowed): string
    {
        $role = $this->convRepo->getRoleInConversation($conversationId, $userId);
        if ($role === null) {
            throw new \RuntimeException('Bạn không phải thành viên của nhóm', 403);
        }
        if (!in_array($role, $allowed, true)) {
            throw new \RuntimeException('Bạn không đủ quyền thực hiện hành động này', 403);
        }
        return $role;
    }

    private function ensureUsersExist(array $userIds): void
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));
        if (empty($userIds)) return;
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $stmt = $this->db->prepare("SELECT id FROM users WHERE id IN ($placeholders)");
        $stmt->execute($userIds);
        $found = array_map(fn($r) => (int) $r['id'], $stmt->fetchAll(PDO::FETCH_ASSOC));
        $missing = array_diff($userIds, $found);
        if (!empty($missing)) {
            throw new \RuntimeException('Một số người dùng không tồn tại: ' . implode(',', $missing), 400);
        }
    }

    private function fetchUsername(int $userId): string
    {
        $stmt = $this->db->prepare('SELECT username FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? (string) $row['username'] : ('User#' . $userId);
    }

    /** @return array<int, array{user_id:int, username:string}> */
    private function fetchUsernames(array $userIds): array
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));
        if (empty($userIds)) return [];
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $stmt = $this->db->prepare("SELECT id, username FROM users WHERE id IN ($placeholders)");
        $stmt->execute($userIds);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map(fn($r) => ['user_id' => (int)$r['id'], 'username' => (string)$r['username']], $rows);
    }

    private function insertSystemMessage(int $conversationId, int $actorId, string $text): int
    {
        $msgId = $this->msgRepo->getNextMsgId($conversationId);
        $seqNo = $this->msgRepo->getNextSeqNo($conversationId, $actorId);
        return $this->msgRepo->create([
            'conversation_id' => $conversationId,
            'sender_id' => $actorId,
            'msg_id' => $msgId,
            'seq_no' => $seqNo,
            'content' => $text,
            'content_type' => 'system',
            'media_url' => null,
            'media_width' => null,
            'media_height' => null,
            'reply_to_msg_id' => null,
        ]);
    }
}
