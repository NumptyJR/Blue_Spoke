<?php
namespace App\Controllers;

use App\Http\Request;
use App\Jwt;
use App\Repositories\UserRepository;
use Throwable;

final class AuthController
{
    private UserRepository $users;

    public function __construct()
    {
        $this->users = new UserRepository();
    }

    public function login(Request $req): array
    {
        $email = (string) ($req->body['email'] ?? '');
        $pass = (string) ($req->body['password'] ?? '');

        $u = $this->users->findByEmail($email);

        if (!$u || !$u['is_active'] || !password_verify($pass, (string) ($u['password_hash'] ?? ''))) {
            return [['error' => 'Invalid credentials'], 401];
        }
        [$token, $exp] = Jwt::issue(['sub' => (int) $u['id'], 'role' => $u['role']]);
        unset($u['password_hash']);
        $_SESSION['user_id'] = (int) $u['id'];
        $_SESSION['token'] = $token;
        setcookie('blue_spoke_token', $token, [
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        error_log(sprintf('[AuthController] login user=%s token_len=%d', $u['email'], strlen($token)));
        return ['token' => $token, 'exp' => $exp, 'user' => $u];
    }

    public function refresh(Request $req): array
    {
        $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer\s+(.*)$/i', $hdr, $m)) {
            $userId = $_SESSION['user_id'] ?? null;
            if ($userId) {
                [$token, $exp] = Jwt::issue(['sub' => (int) $userId, 'role' => $req->user['role'] ?? null]);
                $_SESSION['token'] = $token;
                setcookie('blue_spoke_token', $token, [
                    'path' => '/',
                    'httponly' => true,
                    'samesite' => 'Lax',
                ]);
                return ['token' => $token, 'exp' => $exp];
            }
            return [['error' => 'Missing token'], 401];
        }
        try {
            $claims = Jwt::verify($m[1]);
            [$token, $exp] = Jwt::issue(['sub' => (int) $claims['sub'], 'role' => $claims['role'] ?? null]);
            $_SESSION['token'] = $token;
            return ['token' => $token, 'exp' => $exp];
        } catch (Throwable $e) {
            return [['error' => 'Invalid token'], 401];
        }
    }

    public function me(Request $req): array
    {
        return ['user' => $req->user];
    }

    public function register(Request $req): array
    {
        $b = $req->body;
        $hash = password_hash((string) ($b['password'] ?? ''), PASSWORD_BCRYPT);

        $id = $this->users->create([
            'email' => $b['email'],
            'full_name' => $b['full_name'],
            'role' => $b['role'],
            'password_hash' => $hash
        ]);

        return ['id' => $id];
    }

    public function setPassword(Request $req): array
    {
        $uid = (int) ($req->body['user_id'] ?? 0);
        $pw = (string) ($req->body['new_password'] ?? '');
        if ($uid <= 0 || $pw === '')
            return [['error' => 'user_id and new_password required'], 422];

        $hash = password_hash($pw, PASSWORD_BCRYPT);
        $id = $this->users->updatePassword($uid, $hash);

        return $id ? ['id' => $id] : [['error' => 'Not found'], 404];
    }
}
