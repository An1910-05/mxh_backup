<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use App\Config\Database;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$dryRun = in_array('--dry-run', $argv, true);

function normalizeUploadUrl(?string $url): ?string
{
    if ($url === null) {
        return null;
    }
    $url = trim($url);
    if ($url === '') {
        return null;
    }

    $path = parse_url($url, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        $path = $url;
    }

    if (!str_starts_with($path, '/')) {
        $path = '/' . ltrim($path, '/');
    }

    if (!str_starts_with($path, '/uploads/')) {
        return null;
    }

    return $path;
}

try {
    $db = Database::getConnection();
    $uploadsRoot = realpath(__DIR__ . '/../uploads');
    if ($uploadsRoot === false || !is_dir($uploadsRoot)) {
        throw new RuntimeException('Uploads directory not found: ' . (__DIR__ . '/../uploads'));
    }

    echo '[cleanup-media] Mode: ' . ($dryRun ? 'DRY-RUN' : 'EXECUTE') . PHP_EOL;
    echo '[cleanup-media] Upload root: ' . $uploadsRoot . PHP_EOL;

    // 1) Delete expired stories from DB first.
    $expiredStmt = $db->query('SELECT id, media_url FROM stories WHERE expires_at <= NOW()');
    $expiredStories = $expiredStmt ? $expiredStmt->fetchAll() : [];
    $expiredCount = count($expiredStories);

    if ($expiredCount > 0) {
        echo "[cleanup-media] Expired stories found: {$expiredCount}" . PHP_EOL;
        if (!$dryRun) {
            $delStmt = $db->prepare('DELETE FROM stories WHERE expires_at <= NOW()');
            $delStmt->execute();
            echo '[cleanup-media] Expired stories deleted from DB: ' . $delStmt->rowCount() . PHP_EOL;
        }
    } else {
        echo '[cleanup-media] No expired stories found.' . PHP_EOL;
    }

    // 2) Collect currently referenced upload URLs from DB.
    $refs = [];
    $queries = [
        'SELECT avatar AS p FROM profiles WHERE avatar IS NOT NULL AND avatar <> ""',
        'SELECT cover_photo AS p FROM profiles WHERE cover_photo IS NOT NULL AND cover_photo <> ""',
        'SELECT media_url AS p FROM posts WHERE media_url IS NOT NULL AND media_url <> ""',
        'SELECT media_url AS p FROM comments WHERE media_url IS NOT NULL AND media_url <> ""',
        'SELECT media_url AS p FROM stories WHERE media_url IS NOT NULL AND media_url <> ""',
        'SELECT media_url AS p FROM messages WHERE media_url IS NOT NULL AND media_url <> ""',
        'SELECT avatar AS p FROM conversations WHERE avatar IS NOT NULL AND avatar <> ""',
    ];

    foreach ($queries as $sql) {
        $stmt = $db->query($sql);
        if (!$stmt) {
            continue;
        }
        foreach ($stmt->fetchAll() as $row) {
            $path = normalizeUploadUrl($row['p'] ?? null);
            if ($path !== null) {
                $refs[$path] = true;
            }
        }
    }

    echo '[cleanup-media] Referenced upload paths in DB: ' . count($refs) . PHP_EOL;

    // 3) Walk uploads directory and delete unreferenced files.
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($uploadsRoot, FilesystemIterator::SKIP_DOTS)
    );

    $scanned = 0;
    $deleted = 0;
    $failed = 0;
    $kept = 0;

    /** @var SplFileInfo $file */
    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }
        if (str_starts_with($file->getBasename(), '.')) {
            continue;
        }
        $scanned++;
        $absPath = $file->getPathname();
        $relPath = ltrim(str_replace($uploadsRoot, '', $absPath), '/');
        $urlPath = '/uploads/' . str_replace(DIRECTORY_SEPARATOR, '/', $relPath);

        if (isset($refs[$urlPath])) {
            $kept++;
            continue;
        }

        if ($dryRun) {
            echo "[dry-run] delete {$urlPath}" . PHP_EOL;
            $deleted++;
            continue;
        }

        if (@unlink($absPath)) {
            $deleted++;
            echo "[deleted] {$urlPath}" . PHP_EOL;
        } else {
            $failed++;
            echo "[failed ] {$urlPath}" . PHP_EOL;
        }
    }

    echo '[cleanup-media] Scanned files: ' . $scanned . PHP_EOL;
    echo '[cleanup-media] Kept files: ' . $kept . PHP_EOL;
    echo '[cleanup-media] Deleted files: ' . $deleted . PHP_EOL;
    echo '[cleanup-media] Failed deletes: ' . $failed . PHP_EOL;
    echo '[cleanup-media] Done.' . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, '[cleanup-media] Error: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

