<?php

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Services\ChatService;

class ChatController
{
    private ChatService $chatService;

    public function __construct()
    {
        $this->chatService = new ChatService();
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
}
