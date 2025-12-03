<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: RequireRole.php
// Description: RequireRole middleware

namespace App\Middleware;
use App\Http\{Request, Response};
use App\Config;

final class RequireRole
{
    public function handle(Request $req, callable $next, string $arg): void
    {
        if (!$req->user) {
            if (Config::env('APP_DEBUG', '1') === '1') {
                error_log('[RequireRole] missing user for path: ' . ($req->path ?? '?') . ' method=' . ($req->method ?? '?'));
            }
            Response::json(['error' => 'Unauthorized'], 401);
            return;
        }
        [$mode, $csv] = array_pad(explode(':', $arg, 2), 2, '');
        $allowed = array_filter(array_map('trim', explode(',', $csv)));
        if ($mode === 'only' && !in_array($req->user['role'], $allowed, true)) {
            if (Config::env('APP_DEBUG', '1') === '1') {
                error_log('[RequireRole] forbidden role=' . ($req->user['role'] ?? 'unknown') . ' allowed=' . implode(',', $allowed) . ' path=' . ($req->path ?? '?'));
            }
            Response::json(['error' => 'Forbidden for role: ' . $req->user['role']], 403);
            return;
        }
        $next();
    }
}
