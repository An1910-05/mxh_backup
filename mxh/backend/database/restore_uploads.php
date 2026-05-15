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

// ── POSTS MEDIA (chỉ báo cáo, không can thiệp) ─────────────────────
$postDir = $uploadsRoot . '/posts';
if (is_dir($postDir)) {
    $count = count(array_filter(scandir($postDir), fn($f) => $f !== '.' && $f !== '..'));
    echo "== Posts media ==\n  {$count} files (không tự link vì cần user upload qua API).\n\n";
}

// ── VIDEOS ─────────────────────────────────────────────────────────
$videoDir = $uploadsRoot . '/videos';
if (is_dir($videoDir)) {
    $count = count(array_filter(scandir($videoDir), fn($f) => $f !== '.' && $f !== '..'));
    echo "== Videos ==\n  {$count} files.\n\n";
}

echo "Done.\n";
