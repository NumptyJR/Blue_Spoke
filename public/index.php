<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: index.php
// Description: Entry point
declare(strict_types=1);

use App\Router;

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if ($path === '/' || $path === '/app' || $path === '/app/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/app.html');
    exit;
}

if ($path === '/openapi.yaml') {
    header('Content-Type: application/yaml');
    readfile(__DIR__ . '/../openapi.yaml');
    exit;
}

if (str_starts_with($path, '/assets/')) {
    $file = realpath(__DIR__ . $path);
    $assetsRoot = realpath(__DIR__ . '/assets');
    if ($file && $assetsRoot && str_starts_with($file, $assetsRoot) && is_file($file)) {
        $ext = pathinfo($file, PATHINFO_EXTENSION);
        $types = [
            'css' => 'text/css; charset=utf-8',
            'js' => 'text/javascript; charset=utf-8',
            'json' => 'application/json',
            'svg' => 'image/svg+xml',
        ];
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
        readfile($file);
        exit;
    }
}

require __DIR__ . '/../vendor/autoload.php';
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$allowedOrigins = App\Config::env('CORS_ORIGINS', '*');
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? null;
$originHeader = $allowedOrigins === '*' ? ($requestOrigin ?? '*') : $allowedOrigins;
if ($originHeader) {
    header('Access-Control-Allow-Origin: ' . $originHeader);
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/../bootstrap/app.php';
Router::dispatch();
