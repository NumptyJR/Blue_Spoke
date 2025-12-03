<?php
// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: Database.php
// Description: Database class

namespace App;
use PDO;
use RuntimeException;
use Throwable;

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo)
            return self::$pdo;
        $dsn = sprintf(
            "pgsql:host=%s;port=%s;dbname=%s;options='-c search_path=bike_shop,public'",
            Config::env('PGHOST', '127.0.0.1'),
            Config::env('PGPORT', '5432'),
            Config::env('PGDATABASE', 'postgres')
        );
        self::$pdo = new PDO($dsn, Config::env('PGUSER', 'postgres'), Config::env('PGPASSWORD', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        self::$pdo->exec("SET search_path TO bike_shop, public");
        return self::$pdo;
    }
}
