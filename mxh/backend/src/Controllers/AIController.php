<?php

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

class AIController
{
    public function chat(): void
    {
        AuthMiddleware::authenticate();

        $body = json_decode(file_get_contents('php://input'), true);
        $messages = $body['messages'] ?? [];

        if (empty($messages)) {
            Response::error('Tin nhắn không được trống', 400);
            return;
        }

        $apiKey = $_ENV['GEMINI_API_KEY'] ?? '';
        if (!$apiKey) {
            Response::error('AI chưa được cấu hình', 503);
            return;
        }

        // Build Gemini-format contents (user/model alternating)
        $contents = [];
        foreach ($messages as $msg) {
            $role = ($msg['role'] === 'assistant') ? 'model' : 'user';
            $contents[] = [
                'role'  => $role,
                'parts' => [['text' => $msg['content']]],
            ];
        }

        $payload = json_encode([
            'contents'         => $contents,
            'generationConfig' => [
                'temperature'     => 0.9,
                'maxOutputTokens' => 1024,
            ],
            'systemInstruction' => [
                'parts' => [[
                    'text' => 'Bạn là trợ lý AI thân thiện của mạng xã hội MXH. Trả lời ngắn gọn, tự nhiên bằng tiếng Việt. Có thể hỗ trợ viết caption, gợi ý bài đăng, trả lời câu hỏi thường ngày.'
                ]]
            ],
        ]);

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' . urlencode($apiKey);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false || $httpCode !== 200) {
            Response::error('Không thể kết nối tới AI, thử lại sau', 502);
            return;
        }

        $data = json_decode($raw, true);
        $reply = $data['candidates'][0]['content']['parts'][0]['text']
            ?? 'Xin lỗi, tôi không thể trả lời lúc này.';

        Response::success(['reply' => $reply]);
    }
}
