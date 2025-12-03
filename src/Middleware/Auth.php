<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: Auth.php
// Description: Auth middleware

namespace App\Middleware;
use App\Http\{Request, Response};
use App\{Jwt, Database, Config};
use Throwable;

final class Auth
{
    public function handle(Request $req, callable $next): void
    {
        $sessionUserId = $_SESSION['user_id'] ?? null;
        $hdr = $this->resolveAuthorizationHeader($req);
        if (Config::env('APP_DEBUG', '1') === '1') {
            $qt = isset($req->query['token']) && is_string($req->query['token']) ? (substr($req->query['token'], 0, 6) . '…') : 'none';
            $ht = $hdr ? substr($hdr, 0, 20) . '…' : 'none';
            $ck = isset($_COOKIE['blue_spoke_token']) ? (substr((string) $_COOKIE['blue_spoke_token'], 0, 6) . '…') : 'none';
            error_log(sprintf(
                '[Auth] path=%s query_token=%s body_token=%s header=%s cookie=%s session_user=%s session_id=%s',
                $req->path,
                $qt,
                isset($req->body['token']) ? 'present' : 'none',
                $ht,
                $ck,
                $sessionUserId ?? 'none',
                session_id()
            ));
        }
        // Prefer an established PHP session
        if ($sessionUserId) {
            $user = $this->loadUser((int) $sessionUserId);
            if ($user) {
                $req->user = $user;
                $next();
                return;
            }
        }
        if (!preg_match('/^Bearer\s+(.*)$/i', $hdr, $m)) {
            Response::json(['error' => 'Missing Bearer token'], 401);
            return;
        }
        try {
            $claims = Jwt::verify($m[1]);
            $stmt = Database::pdo()->prepare('SELECT id, email, full_name, role, is_active FROM users WHERE id = ?');
            $stmt->execute([(int) ($claims['sub'] ?? 0)]);
            $user = $stmt->fetch();
            if (!$user || !$user['is_active']) {
                Response::json(['error' => 'User inactive'], 403);
                return;
            }
            $req->user = $user;
            $next();
        } catch (Throwable $e) {
            if (Config::env('APP_DEBUG', '1') === '1') {
                error_log('[Auth] verify failed: ' . $e->getMessage());
            }
            if ($sessionUserId) {
                $user = $this->loadUser((int) $sessionUserId);
                if ($user) {
                    $req->user = $user;
                    $next();
                    return;
                }
            }
            Response::json(['error' => 'Invalid/expired token'], 401);
        }
    }

    private function resolveAuthorizationHeader(Request $req): string
    {
        // Prefer query token
        $queryToken = $req->query['token'] ?? $_GET['token'] ?? null;
        if (!is_string($queryToken) || $queryToken === '') {
            // fallback: parse QUERY_STRING directly
            $qs = $_SERVER['QUERY_STRING'] ?? '';
            if ($qs !== '') {
                parse_str($qs, $arr);
                $queryToken = $arr['token'] ?? null;
            }
        }
        if (!is_string($queryToken) || $queryToken === '') {
            // fallback: parse token from REQUEST_URI query component
            $uri = $_SERVER['REQUEST_URI'] ?? '';
            if ($uri !== '') {
                $q = parse_url($uri, PHP_URL_QUERY);
                if (is_string($q) && $q !== '') {
                    parse_str($q, $arr2);
                    $queryToken = $arr2['token'] ?? null;
                }
            }
        }
        if (is_string($queryToken) && $queryToken !== '')
            return 'Bearer ' . $queryToken;

        $header = $this->findHeader($req->headers, 'Authorization');
        if ($header !== '')
            return $header;

        $altHeader = $this->findHeader($req->headers, 'X-Auth-Token');
        if ($altHeader !== '')
            return "Bearer $altHeader";

        foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $key) {
            if (!empty($_SERVER[$key]))
                return (string) $_SERVER[$key];
        }
        foreach (['HTTP_X_AUTH_TOKEN', 'REDIRECT_HTTP_X_AUTH_TOKEN'] as $key) {
            if (!empty($_SERVER[$key]))
                return 'Bearer ' . $_SERVER[$key];
        }
        if (!empty($_COOKIE['blue_spoke_token'])) {
            return 'Bearer ' . trim((string) $_COOKIE['blue_spoke_token']);
        }
        // Last resort: token in JSON body
        $bodyToken = $req->body['token'] ?? null;
        if (is_string($bodyToken) && $bodyToken !== '') {
            return 'Bearer ' . $bodyToken;
        }
        if (function_exists('getallheaders')) {
            $headers = getallheaders() ?: [];
            $hdr = $this->findHeader($headers, 'Authorization');
            if ($hdr !== '')
                return $hdr;
            $alt = $this->findHeader($headers, 'X-Auth-Token');
            if ($alt !== '')
                return "Bearer $alt";
        }
        return '';
    }

    private function findHeader(array $headers, string $needle): string
    {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string) $name, $needle) === 0) {
                return trim((string) $value);
            }
        }
        return '';
    }

    private function loadUser(int $userId): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT id, email, full_name, role, is_active FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        return ($user && $user['is_active']) ? $user : null;
    }
}
