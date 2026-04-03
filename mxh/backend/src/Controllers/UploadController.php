<?php

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Services\ProfileService;

class UploadController
{
    private const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
    private const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    private const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;

    public function uploadAvatar(): void
    {
        $user = AuthMiddleware::authenticate();

        if (!isset($_FILES['avatar'])) {
            Response::error('No file uploaded', 400);
        }

        $result = $this->saveFile($_FILES['avatar'], 'avatar', $user['id'], self::IMAGE_TYPES, self::MAX_IMAGE_SIZE);

        $profileService = new ProfileService();
        $profileService->updateProfile($user['id'], ['avatar' => $result['url']]);

        Response::success(['avatar' => $result['url']], 'Avatar uploaded successfully');
    }

    public function uploadCover(): void
    {
        $user = AuthMiddleware::authenticate();

        if (!isset($_FILES['cover'])) {
            Response::error('No file uploaded', 400);
        }

        $result = $this->saveFile($_FILES['cover'], 'cover', $user['id'], self::IMAGE_TYPES, self::MAX_IMAGE_SIZE);

        $profileService = new ProfileService();
        $profileService->updateProfile($user['id'], ['cover_photo' => $result['url']]);

        Response::success(['cover_photo' => $result['url']], 'Cover photo uploaded successfully');
    }

    public function uploadPostMedia(): void
    {
        $user = AuthMiddleware::authenticate();

        if (!isset($_FILES['media'])) {
            Response::error('No file uploaded', 400);
        }

        $file = $_FILES['media'];
        $isImage = in_array($file['type'], self::IMAGE_TYPES);
        $isVideo = in_array($file['type'], self::VIDEO_TYPES);

        if (!$isImage && !$isVideo) {
            Response::error('Invalid file type. Allowed: jpeg, png, gif, webp, mp4, webm, mov', 422);
        }

        $maxSize = $isVideo ? self::MAX_VIDEO_SIZE : self::MAX_IMAGE_SIZE;
        $prefix = $isVideo ? 'video' : 'post';

        $result = $this->saveFile($file, $prefix, $user['id'], array_merge(self::IMAGE_TYPES, self::VIDEO_TYPES), $maxSize);

        $response = [
            'media_url' => $result['url'],
            'media_type' => $isVideo ? 'video' : 'image',
            'media_width' => $result['width'],
            'media_height' => $result['height'],
        ];

        Response::success($response, 'Media uploaded successfully');
    }

    private function saveFile(array $file, string $prefix, int $userId, array $allowedTypes, int $maxSize): array
    {
        $uploadError = (int)($file['error'] ?? UPLOAD_ERR_OK);
        if ($uploadError !== UPLOAD_ERR_OK) {
            $message = match ($uploadError) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File vượt quá giới hạn cấu hình upload của server',
                UPLOAD_ERR_PARTIAL => 'File upload chưa hoàn tất',
                UPLOAD_ERR_NO_FILE => 'Không tìm thấy file upload',
                UPLOAD_ERR_NO_TMP_DIR => 'Thiếu thư mục tạm trên server',
                UPLOAD_ERR_CANT_WRITE => 'Server không thể ghi file upload',
                UPLOAD_ERR_EXTENSION => 'Upload bị chặn bởi extension của server',
                default => 'Upload thất bại',
            };
            Response::error($message, 422);
        }

        if (!in_array($file['type'], $allowedTypes)) {
            Response::error('Invalid file type', 422);
        }

        if ($file['size'] > $maxSize) {
            $maxMB = round($maxSize / 1024 / 1024);
            Response::error("File too large. Max {$maxMB}MB", 422);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename = $prefix . '_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;

        $subDir = $prefix === 'video' ? 'videos' : ($prefix === 'post' ? 'posts' : $prefix . 's');
        $uploadDir = __DIR__ . '/../../uploads/' . $subDir . '/';

        if (!is_dir($uploadDir)) {
            $created = @mkdir($uploadDir, 0755, true);
            if (!$created && !is_dir($uploadDir)) {
                Response::error('Không thể tạo thư mục upload trên server', 500);
            }
        }

        if (!is_writable($uploadDir)) {
            Response::error('Thư mục upload không có quyền ghi', 500);
        }

        $destination = $uploadDir . $filename;

        if (!@move_uploaded_file($file['tmp_name'], $destination)) {
            Response::error('Failed to upload file', 500);
        }

        $width = null;
        $height = null;

        $isImage = in_array($file['type'], self::IMAGE_TYPES);

        if ($isImage && function_exists('getimagesize')) {
            $info = @getimagesize($destination);
            if ($info) {
                $width = $info[0];
                $height = $info[1];
            }

            if (function_exists('exif_read_data') && in_array($ext, ['jpg', 'jpeg'])) {
                $exif = @exif_read_data($destination);
                if ($exif && isset($exif['Orientation'])) {
                    $orientation = $exif['Orientation'];
                    if (in_array($orientation, [6, 8, 5, 7])) {
                        [$width, $height] = [$height, $width];
                    }
                }
            }

            $this->autoRotateAndOptimize($destination, $ext);
        }

        if (in_array($file['type'], self::VIDEO_TYPES)) {
            $dims = $this->getVideoDimensions($destination);
            if ($dims) {
                $width = $dims['width'];
                $height = $dims['height'];
            }
        }

        return [
            'url' => '/uploads/' . $subDir . '/' . $filename,
            'width' => $width,
            'height' => $height,
        ];
    }

    private function autoRotateAndOptimize(string $path, string $ext): void
    {
        if (!function_exists('imagecreatefromjpeg')) return;

        $image = null;
        switch ($ext) {
            case 'jpg':
            case 'jpeg':
                $image = @imagecreatefromjpeg($path);
                break;
            case 'png':
                $image = @imagecreatefrompng($path);
                break;
            case 'webp':
                $image = @imagecreatefromwebp($path);
                break;
            default:
                return;
        }

        if (!$image) return;

        $rotated = false;
        if (in_array($ext, ['jpg', 'jpeg']) && function_exists('exif_read_data')) {
            $exif = @exif_read_data($path);
            if ($exif && isset($exif['Orientation'])) {
                switch ($exif['Orientation']) {
                    case 3: $image = imagerotate($image, 180, 0); $rotated = true; break;
                    case 6: $image = imagerotate($image, -90, 0); $rotated = true; break;
                    case 8: $image = imagerotate($image, 90, 0); $rotated = true; break;
                }
            }
        }

        $w = imagesx($image);
        $h = imagesy($image);
        $maxDim = 2048;
        $resized = false;

        if ($w > $maxDim || $h > $maxDim) {
            $ratio = min($maxDim / $w, $maxDim / $h);
            $newW = (int)round($w * $ratio);
            $newH = (int)round($h * $ratio);
            $resizedImg = imagecreatetruecolor($newW, $newH);

            if ($ext === 'png') {
                imagealphablending($resizedImg, false);
                imagesavealpha($resizedImg, true);
            }

            imagecopyresampled($resizedImg, $image, 0, 0, 0, 0, $newW, $newH, $w, $h);
            imagedestroy($image);
            $image = $resizedImg;
            $resized = true;
        }

        if ($rotated || $resized) {
            switch ($ext) {
                case 'jpg':
                case 'jpeg':
                    imagejpeg($image, $path, 85);
                    break;
                case 'png':
                    imagepng($image, $path, 6);
                    break;
                case 'webp':
                    imagewebp($image, $path, 85);
                    break;
            }
        }

        imagedestroy($image);
    }

    private function getVideoDimensions(string $path): ?array
    {
        static $ffprobeAvailable = null;

        if (!function_exists('shell_exec')) {
            return null;
        }

        if ($ffprobeAvailable === null) {
            $ffprobeAvailable = trim((string) @shell_exec('command -v ffprobe 2>/dev/null')) !== '';
        }

        if (!$ffprobeAvailable) {
            return null;
        }

        $cmd = 'ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x ' . escapeshellarg($path) . ' 2>/dev/null';
        $output = @shell_exec($cmd);
        if ($output && preg_match('/(\d+)x(\d+)/', trim($output), $m)) {
            return ['width' => (int)$m[1], 'height' => (int)$m[2]];
        }
        return null;
    }
}
