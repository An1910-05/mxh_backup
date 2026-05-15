<?php

require_once __DIR__ . '/../vendor/autoload.php';

use App\Config\PdoOptions;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$host = $_ENV['DB_HOST'];
$port = $_ENV['DB_PORT'];
$user = $_ENV['DB_USER'];
$pass = $_ENV['DB_PASS'];
$dbName = $_ENV['DB_NAME'];

$migrationFiles = glob(__DIR__ . '/migrations/*.sql');
sort($migrationFiles);

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port}",
        $user,
        $pass,
        PdoOptions::mysqlOptions()
    );

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}`");
    $pdo->exec("USE `{$dbName}`");

    $pdo->exec("CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $executed = $pdo->query("SELECT filename FROM _migrations")->fetchAll(PDO::FETCH_COLUMN);

    foreach ($migrationFiles as $file) {
        $filename = basename($file);

        if (in_array($filename, $executed)) {
            echo "Skip: {$filename} (already executed)\n";
            continue;
        }

        echo "Running: {$filename}...\n";

        $sql = file_get_contents($file);
        // Strip `-- ...` line comments (avoid splitter being confused by `;` in comments)
        $sql = preg_replace('/^\s*--.*$/m', '', $sql);
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn($s) => !empty($s)
        );

        foreach ($statements as $statement) {
            $attempt = $statement;
            // MySQL 8.0.x trước 8.0.29 không hỗ trợ ADD COLUMN/INDEX IF NOT EXISTS
            // → thử statement gốc trước, nếu lỗi syntax 1064 thì strip "IF NOT EXISTS" / "IF EXISTS" rồi retry
            for ($pass = 0; $pass < 2; $pass++) {
                try {
                    $stmt = $pdo->prepare($attempt);
                    $stmt->execute();
                    do { $stmt->fetchAll(); } while ($stmt->nextRowset());
                    $stmt->closeCursor();
                    break;
                } catch (PDOException $e) {
                    $code = $e->errorInfo[1] ?? 0;
                    $msg = $e->getMessage();
                    // Pass 0: nếu là syntax 1064 và statement có IF NOT EXISTS / IF EXISTS → retry bỏ clause đó
                    if ($pass === 0 && $code === 1064 && preg_match('/\bIF\s+(NOT\s+)?EXISTS\b/i', $attempt)) {
                        $attempt = preg_replace('/\bIF\s+NOT\s+EXISTS\b\s*/i', '', $attempt);
                        $attempt = preg_replace('/\bIF\s+EXISTS\b\s*/i', '', $attempt);
                        continue;
                    }
                    // Safe-to-skip: column/key đã tồn tại hoặc không tồn tại
                    if (in_array($code, [1060, 1061, 1091, 1050, 1051], true)) {
                        echo "  Skip stmt ({$code}): " . substr($msg, 0, 100) . "\n";
                        break;
                    }
                    throw $e;
                }
            }
        }

        $pdo->prepare("INSERT INTO _migrations (filename) VALUES (?) ON DUPLICATE KEY UPDATE executed_at = NOW()")->execute([$filename]);
        echo "  Done.\n";
    }

    echo "\nAll migrations completed successfully.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
