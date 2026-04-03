<?php

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (str_starts_with($uri, '/uploads/')) {
    $filePath = __DIR__ . '/../' . $uri;
    if (file_exists($filePath)) {
        $mime = mime_content_type($filePath);
        header("Content-Type: {$mime}");
        header("Cache-Control: public, max-age=86400");
        readfile($filePath);
        return true;
    }
}

// For all other requests, delegate to index.php
require __DIR__ . '/index.php';
return true;
