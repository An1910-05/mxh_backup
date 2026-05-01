<?php

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Services\ChatService;
use App\Services\GroupChatService;

class ChatController
{
    private ChatService $chatService;
    private ?GroupChatService $groupService = null;

    public function __construct()
    {
        $this->chatService = new ChatService();
    }

    private function group(): GroupChatService
    {
        return $this->groupService ??= new GroupChatService();
    }

    public function getConversations(): void
    {
        $user = AuthMiddleware::authenticate();
        $limit = (int)($_GET['limit'] ?? 50);
        $offset = (int)($_GET['offset'] ?? 0);

        $conversations = $this->chatService->getConversations($user['id'], $limit, $offset);
        Response::success($conversations);
    }

    public function getOrCreateConversation(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $targetUserId = (int)($body['user_id'] ?? 0);
        if ($targetUserId <= 0 || $targetUserId === $user['id']) {
            Response::error('Invalid user', 400);
        }

        $conv = $this->chatService->getOrCreatePrivateConversation($user['id'], $targetUserId);
        Response::success($conv);
    }

    public function getMessages(): void
    {
        $user = AuthMiddleware::authenticate();
        $conversationId = (int)($_GET['conversation_id'] ?? 0);
        $limit = (int)($_GET['limit'] ?? 50);
        $beforeId = isset($_GET['before_id']) ? (int)$_GET['before_id'] : null;

        if ($conversationId <= 0) {
            Response::error('Invalid conversation', 400);
        }

        $messages = $this->chatService->getMessages($user['id'], $conversationId, $limit, $beforeId);
        Response::success($messages);
    }

    public function sendMessage(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $conversationId = (int)($body['conversation_id'] ?? 0);
        $content = trim($body['content'] ?? '');
        $contentType = $body['content_type'] ?? 'text';
        $mediaUrl = $body['media_url'] ?? null;
        $mediaWidth = isset($body['media_width']) ? (int)$body['media_width'] : null;
        $mediaHeight = isset($body['media_height']) ? (int)$body['media_height'] : null;
        $replyToMsgId = isset($body['reply_to_msg_id']) ? (int)$body['reply_to_msg_id'] : null;

        if ($conversationId <= 0) {
            Response::error('Invalid conversation', 400);
        }
        if (empty($content) && empty($mediaUrl)) {
            Response::error('Message content required', 400);
        }

        $message = $this->chatService->sendMessage(
            $user['id'], $conversationId, $content,
            $contentType, $mediaUrl, $mediaWidth, $mediaHeight, $replyToMsgId
        );

        Response::success($message, 'Message sent');
    }

    public function markRead(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $conversationId = (int)($body['conversation_id'] ?? 0);
        $messageId = (int)($body['message_id'] ?? 0);

        if ($conversationId <= 0 || $messageId <= 0) {
            Response::error('Invalid params', 400);
        }

        $this->chatService->markAsRead($user['id'], $conversationId, $messageId);
        Response::success(null, 'Marked as read');
    }

    public function editMessage(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $messageId = (int)($body['message_id'] ?? 0);
        $content = trim($body['content'] ?? '');

        if ($messageId <= 0 || empty($content)) {
            Response::error('Invalid params', 400);
        }

        $message = $this->chatService->editMessage($user['id'], $messageId, $content);
        Response::success($message, 'Message edited');
    }

    public function deleteMessage(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $messageId = (int)($body['message_id'] ?? 0);
        if ($messageId <= 0) {
            Response::error('Invalid message', 400);
        }

        $this->chatService->deleteMessage($user['id'], $messageId);
        Response::success(null, 'Message deleted');
    }

    public function unsendMessage(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $messageId = (int)($body['message_id'] ?? 0);
        if ($messageId <= 0) {
            Response::error('Invalid message', 400);
        }

        $message = $this->chatService->unsendMessage($user['id'], $messageId);
        Response::success($message, 'Message unsent');
    }

    public function hideMessage(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);

        $messageId = (int)($body['message_id'] ?? 0);
        if ($messageId <= 0) {
            Response::error('Invalid message', 400);
        }

        $this->chatService->hideMessageForUser($user['id'], $messageId);
        Response::success(null, 'Message hidden');
    }

    public function getReadReceipt(): void
    {
        $user = AuthMiddleware::authenticate();
        $conversationId = (int)($_GET['conversation_id'] ?? 0);

        if ($conversationId <= 0) {
            Response::error('Invalid conversation', 400);
        }

        $receipt = $this->chatService->getReadReceipt($conversationId, $user['id']);
        Response::success($receipt);
    }

    public function searchMessages(): void
    {
        $user = AuthMiddleware::authenticate();
        $conversationId = (int)($_GET['conversation_id'] ?? 0);
        $query = trim($_GET['q'] ?? '');

        if ($conversationId <= 0 || empty($query)) {
            Response::error('Invalid params', 400);
        }

        $results = $this->chatService->searchMessages($user['id'], $conversationId, $query);
        Response::success($results);
    }

    public function clearConversation(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);
        $conversationId = (int)($body['conversation_id'] ?? 0);
        if ($conversationId <= 0) {
            Response::error('Invalid conversation', 400);
        }
        $this->chatService->clearConversationForBoth($user['id'], $conversationId);
        Response::success(null, 'Đã thu hồi toàn bộ tin nhắn ở cả hai bên');
    }

    public function hideConversation(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);
        $conversationId = (int)($body['conversation_id'] ?? 0);
        if ($conversationId <= 0) {
            Response::error('Invalid conversation', 400);
        }
        $this->chatService->hideConversationForMe($user['id'], $conversationId);
        Response::success(null, 'Đã gỡ khỏi danh sách của bạn');
    }

    public function hideAllMessagesForMe(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true);
        $conversationId = (int)($body['conversation_id'] ?? 0);
        if ($conversationId <= 0) {
            Response::error('Invalid conversation', 400);
        }
        $this->chatService->hideAllMessagesForMe($user['id'], $conversationId);
        Response::success(null, 'Đã xóa (ẩn) toàn bộ tin nhắn phía bạn');
    }

    // ===== Group chat (Phase 1 + 2) =====

    public function createGroup(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $title = trim((string)($body['title'] ?? ''));
        $avatar = $body['avatar_url'] ?? null;
        $memberIds = is_array($body['member_ids'] ?? null) ? $body['member_ids'] : [];

        try {
            $conv = $this->group()->createGroup($user['id'], $title, $avatar ?: null, $memberIds);
            Response::success($conv, 'Đã tạo nhóm chat');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function addGroupMembers(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $conversationId = (int)($body['conversation_id'] ?? 0);
        $memberIds = is_array($body['member_ids'] ?? null) ? $body['member_ids'] : [];
        if ($conversationId <= 0) Response::error('Invalid conversation', 400);

        try {
            $result = $this->group()->addMembers($user['id'], $conversationId, $memberIds);
            Response::success($result, 'Đã thêm thành viên');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function removeGroupMember(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $conversationId = (int)($body['conversation_id'] ?? 0);
        $targetUserId = (int)($body['user_id'] ?? 0);
        if ($conversationId <= 0 || $targetUserId <= 0) Response::error('Invalid params', 400);

        try {
            $result = $this->group()->removeMember($user['id'], $conversationId, $targetUserId);
            Response::success($result, 'Đã xoá thành viên');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function updateGroupInfo(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $conversationId = (int)($body['conversation_id'] ?? 0);
        $title = array_key_exists('title', $body) ? (string) $body['title'] : null;
        $avatar = array_key_exists('avatar_url', $body) ? (string) $body['avatar_url'] : null;
        if ($conversationId <= 0) Response::error('Invalid conversation', 400);

        try {
            $conv = $this->group()->updateGroupInfo($user['id'], $conversationId, $title, $avatar);
            Response::success($conv, 'Đã cập nhật nhóm');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function leaveGroup(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $conversationId = (int)($body['conversation_id'] ?? 0);
        if ($conversationId <= 0) Response::error('Invalid conversation', 400);

        try {
            $result = $this->group()->leaveGroup($user['id'], $conversationId);
            Response::success($result, 'Đã rời nhóm');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function changeGroupRole(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $conversationId = (int)($body['conversation_id'] ?? 0);
        $targetUserId = (int)($body['user_id'] ?? 0);
        $newRole = (string)($body['role'] ?? '');
        if ($conversationId <= 0 || $targetUserId <= 0 || !in_array($newRole, ['admin', 'member'], true)) {
            Response::error('Invalid params', 400);
        }

        try {
            $result = $this->group()->changeRole($user['id'], $conversationId, $targetUserId, $newRole);
            Response::success($result, 'Đã cập nhật vai trò');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function dissolveGroup(): void
    {
        $user = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $conversationId = (int)($body['conversation_id'] ?? 0);
        if ($conversationId <= 0) Response::error('Invalid conversation', 400);

        try {
            $result = $this->group()->dissolveGroup($user['id'], $conversationId);
            Response::success($result, 'Đã giải tán nhóm');
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function getGroupMembers(): void
    {
        $user = AuthMiddleware::authenticate();
        $conversationId = (int)($_GET['conversation_id'] ?? 0);
        if ($conversationId <= 0) Response::error('Invalid conversation', 400);

        try {
            $members = $this->group()->getGroupMembers($user['id'], $conversationId);
            Response::success($members);
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }

    public function getGroupReadStatus(): void
    {
        $user = AuthMiddleware::authenticate();
        $conversationId = (int)($_GET['conversation_id'] ?? 0);
        if ($conversationId <= 0) Response::error('Invalid conversation', 400);

        try {
            $status = $this->group()->getGroupReadStatus($user['id'], $conversationId);
            Response::success($status);
        } catch (\Throwable $e) {
            $code = (int) $e->getCode();
            Response::error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 400);
        }
    }
}
