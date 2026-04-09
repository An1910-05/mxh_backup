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
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn($s) => !empty($s)
        );

        foreach ($statements as $statement) {
            $stmt = $pdo->prepare($statement);
            $stmt->execute();

            do {
                $stmt->fetchAll();
            } while ($stmt->nextRowset());

            $stmt->closeCursor();
        }

        $pdo->prepare("INSERT INTO _migrations (filename) VALUES (?)")->execute([$filename]);
        echo "  Done.\n";
    }

    echo "\nAll migrations completed successfully.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
