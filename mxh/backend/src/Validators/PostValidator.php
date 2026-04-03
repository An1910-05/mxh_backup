<?php

namespace App\Validators;

class PostValidator
{
    public static function validateCreate(array $data): array
    {
        $errors = [];
        $content = isset($data['content']) ? trim((string)$data['content']) : '';
        $hasMedia = !empty($data['media_url']);
        $hasLocation = !empty(trim((string)($data['location_label'] ?? '')))
            || (isset($data['latitude']) && $data['latitude'] !== null && $data['latitude'] !== '')
            || (isset($data['longitude']) && $data['longitude'] !== null && $data['longitude'] !== '');

        if ($content === '' && !$hasMedia && !$hasLocation) {
            $errors[] = 'Post needs content, media, or location';
        } elseif (strlen($content) > 5000) {
            $errors[] = 'Post content must not exceed 5000 characters';
        }
        return $errors;
    }

    public static function validateComment(array $data): array
    {
        $errors = [];
        $content = isset($data['content']) ? trim((string)$data['content']) : '';
        $hasMedia = !empty($data['media_url']);
        if ($content === '' && !$hasMedia) {
            $errors[] = 'Comment needs text or image/video';
        } elseif (strlen($content) > 2000) {
            $errors[] = 'Comment must not exceed 2000 characters';
        }
        return $errors;
    }
}
