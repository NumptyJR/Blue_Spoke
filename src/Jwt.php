<?php
declare(strict_types=1);

namespace App;

use Firebase\JWT\JWT as FirebaseJWT;
use Firebase\JWT\Key;

final class Jwt
{
    public static function issue(array $claims): array
    {
        $ttlHours = (int) (Config::env('JWT_TTL_HOURS', '8'));
        $now = time();
        $exp = $now + ($ttlHours * 3600);

        $payload = $claims + [
                'iat' => $now,
                'exp' => $exp,
            ];

        $secret = Config::env('JWT_SECRET', 'change-this-in-production');
        $token  = FirebaseJWT::encode($payload, $secret, 'HS256');

        return [$token, $exp];
    }

    public static function verify(string $token): array
    {
        $secret  = Config::env('JWT_SECRET', 'change-this-in-production');
        $decoded = FirebaseJWT::decode($token, new Key($secret, 'HS256'));

        // Convert stdClass -> array (deep)
        return json_decode(json_encode($decoded, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
    }
}