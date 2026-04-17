<?php

namespace App\WebSocket;

/**
 * MTProto-inspired message protocol for the chat system.
 * 
 * All WebSocket frames follow this structure:
 * {
 *   "type": "method_name",      // MTProto-style method identifier
 *   "msg_id": 1234567890,       // Unique message ID (timestamp-based)
 *   "seq_no": 1,                // Sequence number for ordering
 *   "data": { ... },            // Payload
 *   "ack": [msg_id, ...]        // Optional: acknowledge received msg_ids
 * }
 * 
 * Server responses:
 * {
 *   "type": "result|update|error",
 *   "msg_id": 1234567890,       // References the request msg_id
 *   "data": { ... }
 * }
 */
class ChatProtocol
{
    // Client -> Server methods
    public const METHOD_AUTH = 'auth.login';
    public const METHOD_SEND_MESSAGE = 'messages.send';
    public const METHOD_EDIT_MESSAGE = 'messages.edit';
    public const METHOD_DELETE_MESSAGE = 'messages.delete';
    public const METHOD_UNSEND_MESSAGE = 'messages.unsend';
    public const METHOD_HIDE_MESSAGE = 'messages.hide';
    public const METHOD_READ_HISTORY = 'messages.readHistory';
    public const METHOD_TYPING = 'messages.setTyping';
    public const METHOD_GET_HISTORY = 'messages.getHistory';
    public const METHOD_PING = 'ping';

    // WebRTC call signaling (client <-> server <-> client relay)
    public const METHOD_CALL_OFFER  = 'call.offer';
    public const METHOD_CALL_ANSWER = 'call.answer';
    public const METHOD_CALL_REJECT = 'call.reject';
    public const METHOD_CALL_END    = 'call.end';
    public const METHOD_CALL_ICE    = 'call.ice';

    // Server -> Client updates
    public const UPDATE_NEW_MESSAGE = 'updateNewMessage';
    public const UPDATE_EDIT_MESSAGE = 'updateEditMessage';
    public const UPDATE_DELETE_MESSAGE = 'updateDeleteMessage';
    public const UPDATE_UNSEND_MESSAGE = 'updateUnsendMessage';
    public const UPDATE_READ_HISTORY = 'updateReadHistory';
    public const UPDATE_USER_TYPING = 'updateUserTyping';
    public const UPDATE_USER_STATUS = 'updateUserStatus';
    public const UPDATE_ACK = 'ack';

    public static function generateMsgId(): int
    {
        return (int)(microtime(true) * 1000000);
    }

    public static function createResponse(string $type, int $replyToMsgId, array $data): string
    {
        return json_encode([
            'type' => $type,
            'msg_id' => self::generateMsgId(),
            'reply_to' => $replyToMsgId,
            'data' => $data,
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function createUpdate(string $type, array $data): string
    {
        return json_encode([
            'type' => $type,
            'msg_id' => self::generateMsgId(),
            'data' => $data,
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function createError(int $replyToMsgId, int $code, string $message): string
    {
        return json_encode([
            'type' => 'error',
            'msg_id' => self::generateMsgId(),
            'reply_to' => $replyToMsgId,
            'data' => [
                'code' => $code,
                'message' => $message,
            ],
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function createPong(int $replyToMsgId): string
    {
        return json_encode([
            'type' => 'pong',
            'msg_id' => self::generateMsgId(),
            'reply_to' => $replyToMsgId,
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function parse(string $raw): ?array
    {
        $data = json_decode($raw, true);
        if (!$data || !isset($data['type'])) {
            return null;
        }
        return $data;
    }
}
