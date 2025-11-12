<?php
namespace App\Http;

final class Request
{
    public string $method;
    public string $path;
    public array $headers;
    public array $query;
    public array $body;
    public ?array $user = null; // set by Auth middleware

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $this->path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $this->headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
        $this->query = $_GET ?? [];
        $raw = file_get_contents('php://input') ?: '';
        $this->body = json_decode($raw, true) ?: [];
    }
}
