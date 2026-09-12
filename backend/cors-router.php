<?php

$publicDirectory = __DIR__ . '/public';
$requestPath = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

if (str_contains($requestPath, '..')) {
    http_response_code(400);
    exit('Invalid path');
}

$requestedFile = $publicDirectory . $requestPath;

// If this is a static file request or an OPTIONS preflight specifically for a static file
if ($requestPath !== '/' && (is_file($requestedFile) || (str_starts_with($requestPath, '/storage/') && $_SERVER['REQUEST_METHOD'] === 'OPTIONS'))) {
    $allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Vary: Origin');
    } else {
        header('Access-Control-Allow-Origin: *');
    }

    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, Range, X-Requested-With');
    header('Access-Control-Expose-Headers: Content-Length, Content-Range');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if (is_file($requestedFile)) {
        $extension = strtolower(pathinfo($requestedFile, PATHINFO_EXTENSION));

        $mimeTypes = [
            'svg' => 'image/svg+xml',
            'svgz' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'ico' => 'image/x-icon',
            'json' => 'application/json',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
        ];

        header('Content-Type: ' . ($mimeTypes[$extension] ?? 'application/octet-stream'));
        header('Content-Length: ' . filesize($requestedFile));
        readfile($requestedFile);
        exit;
    }
}

// For all application routes (including /api/* and Sanctum), delegate completely to Laravel.
// Laravel's HandleCors middleware will manage CORS, methods, and auth headers cleanly.
require $publicDirectory . '/index.php';