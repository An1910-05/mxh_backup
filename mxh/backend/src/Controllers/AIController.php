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
                'temperature'     => 0.6,
                'maxOutputTokens' => 512,
            ],
            'systemInstruction' => [
                'parts' => [[
                    'text' => 'Bạn là một trợ lý AI hữu ích, trả lời tự nhiên, chính xác và đúng trọng tâm bằng tiếng Việt như một chatbot AI thông thường. Trả lời mọi câu hỏi và chủ đề một cách bình thường, rõ ràng, không dài dòng, không lạc đề. Nếu được hỏi bạn là ai, chỉ cần nói ngắn gọn rằng bạn là trợ lý AI của iPock. KHÔNG tự động chào hỏi kèm liệt kê khả năng (kiểu "tôi có thể giúp viết caption, gợi ý bài đăng, trả lời câu hỏi thường ngày") trừ khi người dùng hỏi trực tiếp về điều đó.'
                ]]
            ],
        ]);

        // Thử lần lượt các model ổn định. Alias `gemini-flash-latest` hay trả
        // 503 (UNAVAILABLE - quá tải) khiến chat báo "Không thể kết nối tới AI",
        // nên pin model cụ thể + fallback để chịu được lỗi quá tải tạm thời.
        $models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

        $raw = false;
        $httpCode = 0;
        foreach ($models as $model) {
            $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model
                . ':generateContent?key=' . urlencode($apiKey);

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            $raw = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($raw !== false && $httpCode === 200) {
                break;
            }

            // Không nuốt lỗi: ghi log để debug rồi thử model kế tiếp.
            error_log(sprintf(
                '[AIController] Gemini model %s that bai (HTTP %d): %s',
                $model,
                $httpCode,
                is_string($raw) ? substr($raw, 0, 300) : 'curl error'
            ));
        }

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
