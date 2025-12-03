<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: Config.php
// Description: Config class

namespace App;

final class Config
{
    public static function env(string $key, ?string $default = null): ?string
    {
        static $loaded = false;
        if (!$loaded) {
            self::loadEnv();
            $loaded = true;
        }
        $val = getenv($key);
        return $val === false ? $default : $val;
    }

    private static function loadEnv(): void
    {
        $file = __DIR__ . '/../.env';
        if (!is_file($file))
            return;
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with(trim($line), '#'))
                continue;
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2)
                continue;
            [$k, $v] = array_map('trim', $parts);
            if ($k !== '' && $v !== '' && getenv($k) === false)
                putenv("$k=$v");
        }
    }
}