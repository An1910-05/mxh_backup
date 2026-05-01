<?php

namespace App\Services;

use App\Repositories\ConversationRepository;
use App\Repositories\MessageRepository;
use App\Repositories\PresenceRepository;

class ChatService
{
    private ConversationRepository $convRepo;
    private MessageRepository $msgRepo;
    private PresenceRepository $presenceRepo;

    public function __construct()
    {
        $this->convRepo = new ConversationRepository();
        $this->msgRepo = new MessageRepository();
        $this->presenceRepo = new PresenceRepository();
    }

    public function getOrCreatePrivateConversation(int $userId1, int $userId2): array
    {
        $conv = $this->convRepo->findPrivateConversation($userId1, $userId2);
        if ($conv) {
            $this->convRepo->clearHiddenAt((int) $conv['id'], $userId1);
            return $this->enrichConversation($conv, $userId1);
        }

        $convId = $this->convRepo->createConversation('private', $userId1);
        $this->convRepo->addParticipant($convId, $userId1, 'member');
        $this->convRepo->addParticipant($convId, $userId2, 'member');

        $conv = $this->convRepo->findById($convId);
        return $this->enrichConversation($conv, $userId1);
    }

    public function getConversations(int $userId, int $limit = 50, int $offset = 0): array
    {
        $convs = $this->convRepo->getUserConversations($userId, $limit, $offset);
        return array_map(fn($c) => $this->enrichConversation($c, $userId), $convs);
    }

    /** Lấy 1 conversation theo id, enrich đầy đủ (dùng cho GroupChatService trả về sau khi tạo/sửa). */
    public function getConversationForUser(int $conversationId, int $userId): ?array
    {
        $conv = $this->convRepo->findById($conversationId);
        if (!$conv) return null;
        if (!$this->convRepo->isParticipant($conversationId, $userId)) return null;
        $cp = $this->convRepo->getRoleInConversation($conversationId, $userId);
        $conv['my_role'] = $cp;
        return $this->enrichConversation($conv, $userId);
    }

    public function sendMessage(int $senderId, int $conversationId, string $content, string $contentType = 'text', ?string $mediaUrl = null, ?int $mediaWidth = null, ?int $mediaHeight = null, ?int $replyToMsgId = null): array
    {
        if (!$this->convRepo->isParticipant($conversationId, $senderId)) {
            throw new \RuntimeException('Not a participant', 403);
        }

        $msgId = $this->msgRepo->getNextMsgId($conversationId);
        $seqNo = $this->msgRepo->getNextSeqNo($conversationId, $senderId);

        $id = $this->msgRepo->create([
            'conversation_id' => $conversationId,
            'sender_id' => $senderId,
            'msg_id' => $msgId,
            'seq_no' => $seqNo,
            'content' => $content,
            'content_type' => $contentType,
            'media_url' => $mediaUrl,
            'media_width' => $mediaWidth,
            'media_height' => $mediaHeight,
            'reply_to_msg_id' => $replyToMsgId,
        ]);

        $this->convRepo->updateLastRead($conversationId, $senderId, $id);

        return $this->msgRepo->findById($id);
    }

    public function getMessages(int $userId, int $conversationId, int $limit = 50, ?int $beforeId = null): array
    {
        if (!$this->convRepo->isParticipant($conversationId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }

        return $this->msgRepo->getMessages($conversationId, $limit, $beforeId, $userId);
    }

    public function markAsRead(int $userId, int $conversationId, int $messageId): void
    {
        if (!$this->convRepo->isParticipant($conversationId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }
        $this->convRepo->updateLastRead($conversationId, $userId, $messageId);
    }

    public function editMessage(int $userId, int $messageId, string $newContent): array
    {
        $msg = $this->msgRepo->findById($messageId);
        if (!$msg || (int)$msg['sender_id'] !== $userId) {
            throw new \RuntimeException('Cannot edit this message', 403);
        }
        $this->msgRepo->editMessage($messageId, $newContent);
        return $this->msgRepo->findById($messageId);
    }

    public function deleteMessage(int $userId, int $messageId): bool
    {
        $msg = $this->msgRepo->findById($messageId);
        if (!$msg || (int)$msg['sender_id'] !== $userId) {
            throw new \RuntimeException('Cannot delete this message', 403);
        }
        return $this->msgRepo->softDelete($messageId);
    }

    public function unsendMessage(int $userId, int $messageId): array
    {
        $msg = $this->msgRepo->findById($messageId);
        if (!$msg || (int)$msg['sender_id'] !== $userId) {
            throw new \RuntimeException('Cannot unsend this message', 403);
        }
        $this->msgRepo->unsend($messageId);
        return $this->msgRepo->findById($messageId);
    }

    public function hideMessageForUser(int $userId, int $messageId): bool
    {
        $msg = $this->msgRepo->findById($messageId);
        if (!$msg) {
            throw new \RuntimeException('Message not found', 404);
        }
        $convId = (int) $msg['conversation_id'];
        if (!$this->convRepo->isParticipant($convId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }
        return $this->msgRepo->hideForUser($messageId, $userId);
    }

    public function searchMessages(int $userId, int $conversationId, string $query): array
    {
        if (!$this->convRepo->isParticipant($conversationId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }
        return $this->msgRepo->searchInConversation($conversationId, $query);
    }

    public function getConversationParticipantIds(int $conversationId): array
    {
        $participants = $this->convRepo->getParticipants($conversationId);
        return array_map(fn($p) => (int)$p['user_id'], $participants);
    }

    public function getReadReceipt(int $conversationId, int $currentUserId): ?array
    {
        return $this->convRepo->getOtherParticipantReadInfo($conversationId, $currentUserId);
    }

    /** Xóa toàn bộ tin nhắn cho cả hai người (lịch sử trống). */
    public function clearConversationForBoth(int $userId, int $conversationId): void
    {
        if (!$this->convRepo->isParticipant($conversationId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }
        $this->msgRepo->softDeleteAllInConversation($conversationId);
    }

    /** Ẩn hội thoại chỉ ở phía user (không xóa tin nhắn phía đối phương). */
    public function hideConversationForMe(int $userId, int $conversationId): void
    {
        if (!$this->convRepo->isParticipant($conversationId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }
        if (!$this->convRepo->supportsHiddenConversations()) {
            throw new \RuntimeException(
                'Chạy migration database: 010_add_conv_participant_hidden.sql (cột hidden_at).',
                503
            );
        }
        $this->convRepo->setHiddenAt($conversationId, $userId);
    }

    /** Ẩn toàn bộ tin nhắn phía user hiện tại (đối phương vẫn thấy). */
    public function hideAllMessagesForMe(int $userId, int $conversationId): void
    {
        if (!$this->convRepo->isParticipant($conversationId, $userId)) {
            throw new \RuntimeException('Not a participant', 403);
        }
        $this->msgRepo->hideAllVisibleForUserInConversation($conversationId, $userId);
    }

    private function enrichConversation(array $conv, int $currentUserId): array
    {
        if ($conv['type'] === 'private') {
            $other = $this->convRepo->getOtherParticipant((int)$conv['id'], $currentUserId);
            if ($other) {
                $conv['display_name'] = $other['username'];
                $conv['display_avatar'] = $other['avatar'];
                $conv['other_user_id'] = (int)$other['id'];
                $conv['other_custom_url'] = $other['custom_url'];

                $presence = $this->presenceRepo->getPresence((int)$other['id']);
                $conv['is_online'] = $presence ? (bool)$presence['is_online'] : false;
                $conv['last_seen'] = $presence ? $presence['last_seen'] : null;
            }
            $conv['member_count'] = 2;
            $conv['online_member_count'] = !empty($conv['is_online']) ? 1 : 0;
        } else {
            $conv['display_name'] = $conv['title'] ?? 'Nhóm';
            $conv['display_avatar'] = $conv['avatar'];
            $conv['is_online'] = false;
            $conv['last_seen'] = null;
            $conv['member_count'] = $this->convRepo->getMemberCount((int)$conv['id']);
            $conv['online_member_count'] = $this->convRepo->getOnlineMemberCount(
                (int)$conv['id'],
                $currentUserId
            );
            if (!isset($conv['my_role'])) {
                $conv['my_role'] = $this->convRepo->getRoleInConversation((int)$conv['id'], $currentUserId);
            }
        }

        return $conv;
    }
}
