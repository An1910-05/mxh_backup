<?php
/**
 * Restore uploads — quét thư mục backend/uploads/ và map file vào DB.
 *
 * Idempotent: chạy lại nhiều lần không phá data.
 * Dùng sau khi seed hoặc khi pull project lên máy mới mà DB chưa link tới ảnh.
 *
 * Cách dùng:
 *   docker compose exec backend php database/restore_uploads.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use App\Config\PdoOptions;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$host = $_ENV['DB_HOST'];
$port = $_ENV['DB_PORT'];
$user = $_ENV['DB_USER'];
$pass = $_ENV['DB_PASS'];
$dbName = $_ENV['DB_NAME'];

$uploadsRoot = realpath(__DIR__ . '/../uploads');
if (!$uploadsRoot) {
    echo "[skip] backend/uploads/ không tồn tại — không có gì để restore.\n";
    exit(0);
}

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4",
        $user,
        $pass,
        PdoOptions::mysqlOptions()
    );
} catch (PDOException $e) {
    fwrite(STDERR, "[error] Connect DB failed: " . $e->getMessage() . "\n");
    exit(1);
}

$existingUserIds = $pdo->query("SELECT id FROM users")->fetchAll(PDO::FETCH_COLUMN);
$existingUserIds = array_map('intval', $existingUserIds);

/**
 * Quét thư mục, parse filename theo pattern `{prefix}_{userId}_{timestamp}_{hash}.{ext}`,
 * trả mảng [userId => latestFilename] (chọn file có timestamp lớn nhất).
 */
function scanByUser(string $dir, string $prefix): array
{
    if (!is_dir($dir)) return [];
    $latest = [];
    foreach (scandir($dir) as $name) {
        if ($name === '.' || $name === '..') continue;
        if (!preg_match("/^{$prefix}_(\d+)_(\d+)_[^.]+\.[A-Za-z0-9]+$/", $name, $m)) continue;
        $uid = (int) $m[1];
        $ts  = (int) $m[2];
        if (!isset($latest[$uid]) || $ts > $latest[$uid]['ts']) {
            $latest[$uid] = ['ts' => $ts, 'name' => $name];
        }
    }
    return $latest;
}

/**
 * Quét TẤT CẢ file media theo prefix (khác scanByUser: không gộp về 1 file/user).
 * Trả mảng record [uid, ts, name, type, url, path] để map từng file vào từng post.
 */
function scanAllMedia(string $dir, string $prefix, string $mediaType, string $subDir): array
{
    if (!is_dir($dir)) return [];
    $out = [];
    foreach (scandir($dir) as $name) {
        if ($name === '.' || $name === '..') continue;
        if (!preg_match("/^{$prefix}_(\d+)_(\d+)_[^.]+\.[A-Za-z0-9]+$/", $name, $m)) continue;
        $out[] = [
            'uid'  => (int) $m[1],
            'ts'   => (int) $m[2],
            'name' => $name,
            'type' => $mediaType,
            'url'  => '/uploads/' . $subDir . '/' . $name,
            'path' => $dir . '/' . $name,
        ];
    }
    return $out;
}

// ── AVATARS ────────────────────────────────────────────────────────
echo "== Avatars ==\n";
$avatars = scanByUser($uploadsRoot . '/avatars', 'avatar');
$updated = 0; $skipped = 0;
foreach ($avatars as $uid => $info) {
    if (!in_array($uid, $existingUserIds, true)) {
        echo "  Skip user_id={$uid}: không tồn tại trong DB (file: {$info['name']})\n";
        $skipped++; continue;
    }
    $path = '/uploads/avatars/' . $info['name'];
    $stmt = $pdo->prepare(
        "UPDATE profiles SET avatar = ?
         WHERE user_id = ? AND (avatar IS NULL OR avatar = '' OR avatar <> ?)"
    );
    $stmt->execute([$path, $uid, $path]);
    if ($stmt->rowCount() > 0) {
        echo "  user_id={$uid} → {$path}\n";
        $updated++;
    }
}
echo "  Đã cập nhật {$updated} avatar, skip {$skipped}.\n\n";

// ── COVERS ─────────────────────────────────────────────────────────
echo "== Covers ==\n";
$covers = scanByUser($uploadsRoot . '/covers', 'cover');
$coverUpdated = 0;
// Kiểm tra cột cover_photo có tồn tại không
$hasCoverCol = $pdo->query("SHOW COLUMNS FROM profiles LIKE 'cover_photo'")->fetch() !== false;
if (!$hasCoverCol) {
    echo "  Skip: cột profiles.cover_photo không tồn tại.\n\n";
} else {
    foreach ($covers as $uid => $info) {
        if (!in_array($uid, $existingUserIds, true)) continue;
        $path = '/uploads/covers/' . $info['name'];
        $stmt = $pdo->prepare(
            "UPDATE profiles SET cover_photo = ?
             WHERE user_id = ? AND (cover_photo IS NULL OR cover_photo = '' OR cover_photo <> ?)"
        );
        $stmt->execute([$path, $uid, $path]);
        if ($stmt->rowCount() > 0) {
            echo "  user_id={$uid} → {$path}\n";
            $coverUpdated++;
        }
    }
    echo "  Đã cập nhật {$coverUpdated} cover.\n\n";
}

// ── POST MEDIA + VIDEOS: relink file mồ côi vào post có media_url NULL ──
// Tên file chỉ chứa user_id (post_{userId}_{ts}_...), KHÔNG có post_id → không
// map tuyệt đối được. Chiến lược thận trọng: với mỗi post đang thiếu media, tìm
// file CÙNG user_id có timestamp gần nhất, nằm trong cửa sổ [created_at - 30',
// created_at + 2'] (user upload file rồi mới đăng post vài giây→phút sau).
// Mỗi file dùng 1 lần, chỉ điền vào post có media_url NULL → idempotent, không
// đè media sẵn có, tránh gắn nhầm ảnh cho post text.
echo "== Post media & videos (relink) ==\n";

$candidates = array_merge(
    scanAllMedia($uploadsRoot . '/posts', 'post', 'image', 'posts'),
    scanAllMedia($uploadsRoot . '/videos', 'video', 'video', 'videos')
);

$nullPosts = $pdo->query(
    "SELECT id, user_id, UNIX_TIMESTAMP(created_at) AS epoch
     FROM posts WHERE media_url IS NULL OR media_url = ''
     ORDER BY created_at ASC, id ASC"
)->fetchAll(PDO::FETCH_ASSOC);

$windowBefore = 1800; // 30 phút trước khi đăng
$windowAfter  = 120;  // 2 phút sau (dự phòng lệch giờ)
$used = [];
$linked = 0;

foreach ($nullPosts as $post) {
    $uid = (int) $post['user_id'];
    $epoch = (int) $post['epoch'];
    $best = null;
    $bestDiff = PHP_INT_MAX;

    foreach ($candidates as $c) {
        if ($c['uid'] !== $uid || isset($used[$c['name']])) continue;
        if ($c['ts'] < $epoch - $windowBefore || $c['ts'] > $epoch + $windowAfter) continue;
        $diff = abs($epoch - $c['ts']);
        if ($diff < $bestDiff) { $bestDiff = $diff; $best = $c; }
    }

    if ($best === null) continue;

    $w = null; $h = null;
    if ($best['type'] === 'image' && function_exists('getimagesize')) {
        $info = @getimagesize($best['path']);
        if ($info) { $w = $info[0]; $h = $info[1]; }
    }

    $stmt = $pdo->prepare(
        "UPDATE posts SET media_url = ?, media_type = ?, media_width = ?, media_height = ?
         WHERE id = ? AND (media_url IS NULL OR media_url = '')"
    );
    $stmt->execute([$best['url'], $best['type'], $w, $h, (int) $post['id']]);
    if ($stmt->rowCount() > 0) {
        $used[$best['name']] = true;
        $linked++;
        echo "  post#{$post['id']} (user {$uid}) → {$best['url']}\n";
    }
}

$imgCount = count(scanAllMedia($uploadsRoot . '/posts', 'post', 'image', 'posts'));
$vidCount = count(scanAllMedia($uploadsRoot . '/videos', 'video', 'video', 'videos'));
echo "  Đã link {$linked} post media.\n";
echo "  (Tổng: {$imgCount} ảnh post + {$vidCount} video. File không khớp post nào là mồ côi từ post đã xoá — bỏ qua.)\n\n";

echo "Done.\n";
