<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;
use App\WebSocket\ChatServer;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$port = (int)($_ENV['WS_PORT'] ?? 8080);

echo "============================================\n";
echo " MXH Chat WebSocket Server\n";
echo " MTProto-inspired Cloud Messaging Protocol\n";
echo " Port: {$port}\n";
echo "============================================\n";

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new ChatServer()
        )
    ),
    $port
);

echo "WebSocket server started on ws://0.0.0.0:{$port}\n";

$server->run();
