<?php
namespace App;
use PDO;
use RuntimeException;
use Throwable;

final class Database
{
    private static ?PDO $pdo = null;
    private static bool $initialized = false;

    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
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
        self::ensureSchema(self::$pdo);
        return self::$pdo;
    }

    private static function ensureSchema(PDO $pdo): void
    {
        if (self::$initialized) return;
        $needsBootstrap = false;
        try {
            $stmt = $pdo->query("SELECT to_regclass('bike_shop.users') AS exists");
            $needsBootstrap = !$stmt->fetchColumn();
        } catch (Throwable $e) {
            $needsBootstrap = true;
        }

        if ($needsBootstrap) {
            $candidates = [
                __DIR__ . '/../database/schema.sql',
                __DIR__ . '/../database/bootstrap.sql',
            ];
            $sqlFile = null;
            foreach ($candidates as $candidate) {
                if (is_file($candidate)) {
                    $sqlFile = $candidate;
                    break;
                }
            }
            if (!$sqlFile) {
                throw new RuntimeException('No database schema file found (expected database/schema.sql or database/bootstrap.sql)');
            }
            $sql = file_get_contents($sqlFile);
            if ($sql === false) {
                throw new RuntimeException("Unable to read schema file: $sqlFile");
            }
            $pdo->exec($sql);
        }
        $pdo->exec("ALTER TABLE IF EXISTS bike_shop.users ADD COLUMN IF NOT EXISTS pin_code CHAR(4) UNIQUE");
        $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS users_pin_code_idx ON bike_shop.users(pin_code)");
        $pdo->beginTransaction();
        $st = $pdo->query("SELECT id FROM bike_shop.users WHERE pin_code IS NULL ORDER BY id FOR UPDATE");
        $code = 1001;
        while ($row = $st->fetchColumn()) {
            $pin = str_pad((string)$code, 4, '0', STR_PAD_LEFT);
            $upd = $pdo->prepare("UPDATE bike_shop.users SET pin_code = :pin WHERE id = :id");
            $upd->execute([':pin' => $pin, ':id' => $row]);
            $code++;
        }
        $pdo->commit();
        self::$initialized = true;
    }
}
