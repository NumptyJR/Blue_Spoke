<?php
namespace App\Http;

final class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            http_response_code(500);
            echo json_encode(['error' => 'JSON encoding failed'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            return;
        }
        echo $json;
    }

    public static function error(string $msg, int $status = 400): void {
        self::json(['error' => $msg], $status);
    }
}