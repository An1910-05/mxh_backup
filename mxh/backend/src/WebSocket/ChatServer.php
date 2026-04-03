<?php

namespace App\WebSocket;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use App\Services\ChatService;
use App\Repositories\PresenceRepository;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class ChatServer implements MessageComponentInterface
{
    /** @var \SplObjectStorage<ConnectionInterface, array> */
    private \SplObjectStorage $connections;

    /** @var array<int, ConnectionInterface[]> userId => connections */
    private array $userConnections = [];

    private ChatService $chatService;
    private PresenceRepository $presenceRepo;
    private string $jwtSecret;

    /** @var array<string, array{user_id: int, conversation_id: int, time: float}> */
    private array $typingState = [];

    public function __construct()
    {
        $this->connections = new \SplObjectStorage();
        $this->chatService = new ChatService();
        $this->presenceRepo = new PresenceRepository();
        $this->jwtSecret = $_ENV['JWT_SECRET'] ?? 'mxh-dev-secret-key-2024';
    }

    public function onOpen(ConnectionInterface $conn): void
    {
        $this->connections->attach($conn, ['user_id' => null, 'authenticated' => false]);
        echo "New connection: {$conn->resourceId}\n";
    }

    public function onMessage(ConnectionInterface $conn, $msg): void
    {
        $frame = ChatProtocol::parse($msg);
        if (!$frame) {
            $conn->send(ChatProtocol::createError(0, 400, 'Invalid message format'));
            return;
        }

        $type = $frame['type'];
        $msgId = $frame['msg_id'] ?? 0;
        $data = $frame['data'] ?? [];

        if ($type === ChatProtocol::METHOD_AUTH) {
            $this->handleAuth($conn, $msgId, $data);
            return;
        }

        if ($type === ChatProtocol::METHOD_PING) {
            $conn->send(ChatProtocol::createPong($msgId));
            return;
        }

        $connData = $this->connections[$conn];
        if (!$connData['authenticated']) {
            $conn->send(ChatProtocol::createError($msgId, 401, 'Not authenticated'));
            return;
        }

        $userId = $connData['user_id'];

        try {
            match ($type) {
                ChatProtocol::METHOD_SEND_MESSAGE => $this->handleSendMessage($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_EDIT_MESSAGE => $this->handleEditMessage($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_DELETE_MESSAGE => $this->handleDeleteMessage($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_UNSEND_MESSAGE => $this->handleUnsendMessage($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_HIDE_MESSAGE => $this->handleHideMessage($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_READ_HISTORY => $this->handleReadHistory($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_TYPING => $this->handleTyping($conn, $userId, $msgId, $data),
                ChatProtocol::METHOD_GET_HISTORY => $this->handleGetHistory($conn, $userId, $msgId, $data),
                default => $conn->send(ChatProtocol::createError($msgId, 400, "Unknown method: {$type}")),
            };
        } catch (\Throwable $e) {
            $conn->send(ChatProtocol::createError($msgId, 500, $e->getMessage()));
        }
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $connData = $this->connections[$conn];
        $userId = $connData['user_id'] ?? null;

        if ($userId) {
            $this->removeUserConnection($userId, $conn);

            if (empty($this->userConnections[$userId])) {
                $this->presenceRepo->setOffline($userId);
                $this->broadcastPresence($userId, false);
            }
        }

        $this->connections->detach($conn);
        echo "Connection closed: {$conn->resourceId}\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        echo "Error on {$conn->resourceId}: {$e->getMessage()}\n";
        $conn->close();
    }

    private function handleAuth(ConnectionInterface $conn, int $msgId, array $data): void
    {
        $token = $data['token'] ?? '';
        if (empty($token)) {
            $conn->send(ChatProtocol::createError($msgId, 401, 'Token required'));
            return;
        }

        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));
            $userId = (int)$decoded->user_id;

            $connData = $this->connections[$conn];
            $connData['user_id'] = $userId;
            $connData['authenticated'] = true;
            $this->connections[$conn] = $connData;

            $this->addUserConnection($userId, $conn);
            $this->presenceRepo->setOnline($userId);
            $this->broadcastPresence($userId, true);

            $conn->send(ChatProtocol::createResponse('auth.success', $msgId, [
                'user_id' => $userId,
            ]));

            echo "User {$userId} authenticated on connection {$conn->resourceId}\n";
        } catch (\Throwable $e) {
            $conn->send(ChatProtocol::createError($msgId, 401, 'Invalid token'));
        }
    }

    private function handleSendMessage(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $conversationId = (int)($data['conversation_id'] ?? 0);
        $content = $data['content'] ?? '';
        $contentType = $data['content_type'] ?? 'text';
        $mediaUrl = $data['media_url'] ?? null;
        $mediaWidth = isset($data['media_width']) ? (int)$data['media_width'] : null;
        $mediaHeight = isset($data['media_height']) ? (int)$data['media_height'] : null;
        $replyToMsgId = isset($data['reply_to_msg_id']) ? (int)$data['reply_to_msg_id'] : null;
        $clientMsgId = $data['client_msg_id'] ?? null;

        $message = $this->chatService->sendMessage(
            $userId, $conversationId, $content,
            $contentType, $mediaUrl, $mediaWidth, $mediaHeight, $replyToMsgId
        );

        $message['client_msg_id'] = $clientMsgId;

        $conn->send(ChatProtocol::createResponse(ChatProtocol::UPDATE_ACK, $msgId, $message));

        $participantIds = $this->chatService->getConversationParticipantIds($conversationId);
        foreach ($participantIds as $participantId) {
            if ($participantId === $userId) continue;
            $this->sendToUser($participantId, ChatProtocol::createUpdate(
                ChatProtocol::UPDATE_NEW_MESSAGE,
                $message
            ));
        }
    }

    private function handleEditMessage(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $messageId = (int)($data['message_id'] ?? 0);
        $content = $data['content'] ?? '';

        $message = $this->chatService->editMessage($userId, $messageId, $content);

        $conn->send(ChatProtocol::createResponse('result', $msgId, $message));

        $participantIds = $this->chatService->getConversationParticipantIds((int)$message['conversation_id']);
        foreach ($participantIds as $participantId) {
            if ($participantId === $userId) continue;
            $this->sendToUser($participantId, ChatProtocol::createUpdate(
                ChatProtocol::UPDATE_EDIT_MESSAGE,
                $message
            ));
        }
    }

    private function handleDeleteMessage(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $messageId = (int)($data['message_id'] ?? 0);

        $msg = $this->chatService->deleteMessage($userId, $messageId);

        $conn->send(ChatProtocol::createResponse('result', $msgId, ['deleted' => true]));

        // We need conversation_id — get it from message before deletion
        // Since softDelete keeps the row, re-query
        $msgRepo = new \App\Repositories\MessageRepository();
        $deletedMsg = $msgRepo->findById($messageId);
        if ($deletedMsg) {
            $participantIds = $this->chatService->getConversationParticipantIds((int)$deletedMsg['conversation_id']);
            foreach ($participantIds as $participantId) {
                if ($participantId === $userId) continue;
                $this->sendToUser($participantId, ChatProtocol::createUpdate(
                    ChatProtocol::UPDATE_DELETE_MESSAGE,
                    ['message_id' => $messageId, 'conversation_id' => (int)$deletedMsg['conversation_id']]
                ));
            }
        }
    }

    private function handleUnsendMessage(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $messageId = (int)($data['message_id'] ?? 0);

        $message = $this->chatService->unsendMessage($userId, $messageId);

        $conn->send(ChatProtocol::createResponse('result', $msgId, $message));

        $participantIds = $this->chatService->getConversationParticipantIds((int)$message['conversation_id']);
        foreach ($participantIds as $participantId) {
            if ($participantId === $userId) continue;
            $this->sendToUser($participantId, ChatProtocol::createUpdate(
                ChatProtocol::UPDATE_UNSEND_MESSAGE,
                ['message_id' => $messageId, 'conversation_id' => (int)$message['conversation_id']]
            ));
        }
    }

    private function handleHideMessage(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $messageId = (int)($data['message_id'] ?? 0);

        $this->chatService->hideMessageForUser($userId, $messageId);

        $conn->send(ChatProtocol::createResponse('result', $msgId, ['hidden' => true]));
    }

    private function handleReadHistory(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $conversationId = (int)($data['conversation_id'] ?? 0);
        $maxId = (int)($data['max_id'] ?? 0);

        $this->chatService->markAsRead($userId, $conversationId, $maxId);

        $conn->send(ChatProtocol::createResponse('result', $msgId, ['ok' => true]));

        $participantIds = $this->chatService->getConversationParticipantIds($conversationId);
        foreach ($participantIds as $participantId) {
            if ($participantId === $userId) continue;
            $this->sendToUser($participantId, ChatProtocol::createUpdate(
                ChatProtocol::UPDATE_READ_HISTORY,
                ['conversation_id' => $conversationId, 'user_id' => $userId, 'max_id' => $maxId]
            ));
        }
    }

    private function handleTyping(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $conversationId = (int)($data['conversation_id'] ?? 0);

        $participantIds = $this->chatService->getConversationParticipantIds($conversationId);
        foreach ($participantIds as $participantId) {
            if ($participantId === $userId) continue;
            $this->sendToUser($participantId, ChatProtocol::createUpdate(
                ChatProtocol::UPDATE_USER_TYPING,
                ['conversation_id' => $conversationId, 'user_id' => $userId]
            ));
        }
    }

    private function handleGetHistory(ConnectionInterface $conn, int $userId, int $msgId, array $data): void
    {
        $conversationId = (int)($data['conversation_id'] ?? 0);
        $limit = (int)($data['limit'] ?? 50);
        $beforeId = isset($data['before_id']) ? (int)$data['before_id'] : null;

        $messages = $this->chatService->getMessages($userId, $conversationId, $limit, $beforeId);

        $conn->send(ChatProtocol::createResponse('result', $msgId, [
            'messages' => $messages,
            'conversation_id' => $conversationId,
        ]));
    }

    private function broadcastPresence(int $userId, bool $isOnline): void
    {
        $update = ChatProtocol::createUpdate(ChatProtocol::UPDATE_USER_STATUS, [
            'user_id' => $userId,
            'is_online' => $isOnline,
        ]);

        foreach ($this->connections as $conn) {
            $data = $this->connections[$conn];
            if ($data['authenticated'] && $data['user_id'] !== $userId) {
                $conn->send($update);
            }
        }
    }

    private function sendToUser(int $userId, string $message): void
    {
        if (isset($this->userConnections[$userId])) {
            foreach ($this->userConnections[$userId] as $conn) {
                $conn->send($message);
            }
        }
    }

    private function addUserConnection(int $userId, ConnectionInterface $conn): void
    {
        if (!isset($this->userConnections[$userId])) {
            $this->userConnections[$userId] = [];
        }
        $this->userConnections[$userId][] = $conn;
    }

    private function removeUserConnection(int $userId, ConnectionInterface $conn): void
    {
        if (!isset($this->userConnections[$userId])) return;
        $this->userConnections[$userId] = array_filter(
            $this->userConnections[$userId],
            fn($c) => $c !== $conn
        );
        if (empty($this->userConnections[$userId])) {
            unset($this->userConnections[$userId]);
        }
    }
}
